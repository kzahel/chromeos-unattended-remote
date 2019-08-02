import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.options
import tornado.websocket

import base64
import json
import os
import io
import pdb

#from tornado.log import enable_pretty_logging
#enable_pretty_logging()

from tornado.options import define, options

define("port", default=8000, help="port to listen on")
define("debug", default=True, help="debug", type=bool)
define("openauth", default=False, help="open auth (no password needed)", type=bool)


from screenshot.gbm import crtcScreenshot
from faketouchscreen import FakeTouchscreen
touchscreen = FakeTouchscreen()
from fakekeyboard import FakeKeyboard
fakekb = FakeKeyboard()

DEFAULT_PORT = 8000
def initialize_settings():
    if os.path.exists('settings.json'):
        with open('settings.json') as fo:
            settings = json.loads(fo.read())
    else:
        password = base64.b64encode(os.urandom(40))
        settings = dict(password=password, port=DEFAULT_PORT)
        with open('settings.json','w') as fo:
            fo.write(json.dumps(settings,indent=2))
    return settings

settings = initialize_settings()
print 'listening on 127.0.0.1:%s' % settings['port']
print 'rpc password is:', settings['password']

def basicauth(func):
    def inner(self, *args, **kw):
        if options.openauth:
            return func(self, *args, **kw)
        if self.get_current_user():
            return func(self, *args, **kw)
        else:
            self.send_unauthorized()
    return inner


class BH(tornado.web.RequestHandler):
    def set_cors(self):
        self.set_header('Access-Control-Expose-Headers','content-length')

    def get_current_user(self):
        if 'authorization' in self.request.headers:
            s = self.request.headers.get('authorization').split(' ')[1]
            username, password = base64.b64decode(s).split(':')
            if password == settings['password']:
                return True

    def send_unauthorized(self):
        self.set_status(403)
        self.write('unauthorized')
    
class MainHandler(BH):
    def get(self):
        self.write("Hello, world")

class FakeScreenshotHandler(BH):
    @basicauth
    def get(self):
        self.set_cors()
        self.set_header('content-type','image/png')
        self.write(open('screenshot.png','rb').read())

class ScreenshotHandler(BH):
    @basicauth
    def get(self):
        self.set_header('content-type','image/png')
        self.set_cors()
        if not os.path.exists('/dev/dri'):
            # pass
            self.write(open('screenshot.png','rb').read())
            return
            
        screen_num=0
        try:
            image = crtcScreenshot(screen_num)
        except Exception, e:
            self.set_status(500)
            logging.error(e)
            self.write('error getting screenshot')
            return
        # this can segfault or maybe we can catch it at this point already
        print('got image',image)
        imgByteArr = io.BytesIO()
        image.save(imgByteArr, format='PNG')
        imgByteArr = imgByteArr.getvalue()
        self.write(imgByteArr)

class ClickHandler(BH):
    @basicauth
    def get(self):
        x = int(self.get_argument('x'))
        y = int(self.get_argument('y'))
        touchscreen.touch(x,y)
        self.write('ok')
        
class UTypeHandler(BH):
    @basicauth
    def post(self):
        data = json.loads(self.request.body.decode('utf-8'))
        print('please type',data['text'])
        fakekb.utype(data['text'])
        self.write('ok')

class RawKeyboardHandler(BH):
    @basicauth
    def post(self):
        data = json.loads(self.request.body.decode('utf-8'))
        event = data['event']
        print('handle raw keyboard event',event)

        # keydown is sensitive to timing on when keyup event gets sent...
        # it can repeat even if you dont want it to.

        # cant use JS keypress because it wont send CTRL key for example

        fakekb.rawevent(event)
        # fakekb.(data['text'])
        self.write('ok')

class KeypressHandler(BH):
    @basicauth
    def post(self):
        # these events can still come out of order! (because chrome uses multiple connections)
        # we want the events in the same order, so we will have to use a websocket instead.
        
        data = json.loads(self.request.body.decode('utf-8'))
        event = data['event']
        print('handle keypress event',event)
        fakekb.press(event['key'])
        self.write('ok')

class RPCHandler(tornado.websocket.WebSocketHandler):
    def check_origin(self, origin):
        ext_origin = 'chrome-extension://clpjjmbkkeeceijbgonalbjhepbikhhm'
        if origin == ext_origin:
            return True
        else:
            print 'origin must be',ext_origin
    
    def open(self):
        self.authenticated = False
        print("WebSocket opened")

    def check_message(self, message):
        required = set(['id','type','payload'])
        return set(required) == set(message.keys())

    def doclose(self, reason):
        self.close(1, reason)
        
    def on_message(self, message):
        message = json.loads(message)
        if not self.check_message(message):
            print 'invalid message',message
            return self.doclose('invalid message')
        if not self.authenticated:
            if message['type'] == 'AUTH':
                if options.openauth:
                    self.authenticated = True
                    self.respond(message, {'ok':True})
                elif message['payload']['password'] == settings['password']:
                    self.authenticated = True
                    self.respond(message, {'ok':True})
                else:
                    self.doclose('invalid credentials')
            else:
                self.doclose('not authenticated')
        else:
            self.handle_request(message)

    def handle_request(self, req):
        if not self.authenticated:
            return self.doclose('not authenticated')

        type = req['type']
        payload = req['payload']
        if type == 'RAW_KEYBOARD':
            fakekb.rawevent(payload['event'])
            self.respond(req, dict(ok=True))
        else:
            self.respond(req, dict(error=True, message='unknown message type'))
        
    def send(self, d):
        return self.write_message(json.dumps(d))
        
    def respond(self, req, data):
        id = req['id']
        self.send(dict(id=id, type=req['type'], payload=data))
        
    def on_close(self):
        print("WebSocket closed")
        
def main():
    tornado.options.parse_command_line()
    routes = [
        (r"/", MainHandler),
        ('/screenshot.png', FakeScreenshotHandler),
        ('/screenshot', ScreenshotHandler),
        ('/click', ClickHandler),
        ('/utype', UTypeHandler),
        ('/rawkeyboard', RawKeyboardHandler),
        ('/keypress', KeypressHandler),
        ('/wsRPC', RPCHandler),
    ]
    application = tornado.web.Application(routes,
                                          debug=options.debug)
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(options.port, address='127.0.0.1')
    tornado.ioloop.IOLoop.current().start()


if __name__ == "__main__":
    main()
