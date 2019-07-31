import tornado.httpserver
import tornado.ioloop
import tornado.web

import base64
import json
import os
import io
import pdb

from tornado.log import enable_pretty_logging
enable_pretty_logging()

from screenshot.gbm import crtcScreenshot
from faketouchscreen import FakeTouchscreen
touchscreen = FakeTouchscreen()

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
        screen_num=0
        image = crtcScreenshot(screen_num)
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
        

def main():
    application = tornado.web.Application([
        (r"/", MainHandler),
        ('/screenshot.png', FakeScreenshotHandler),
        ('/screenshot', ScreenshotHandler),
        ('/click', ClickHandler),
    ])
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(settings['port'])
    tornado.ioloop.IOLoop.current().start()


if __name__ == "__main__":
    main()
