import SimpleHTTPServer
import SocketServer
import base64
import json
import os
import io

import pdb

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

Handler = SimpleHTTPServer.SimpleHTTPRequestHandler

class Handler(SimpleHTTPServer.SimpleHTTPRequestHandler):

    def authenticated(self):
        failed = True
        if 'authorization' in self.headers:
            s = self.headers['authorization'].split(' ')[1]
            username, password = base64.b64decode(s).split(':')
            if password == settings['password']:
                failed = False
        if failed:
            self.unauthorized()
        return failed
            
    def unauthorized(self):
        print '403 unauthorized'
        self.send_response(403)
        self.end_headers()
        self.wfile.write('unauthorized')

    def do_click(self, x, y):
        touchscreen.touch(x,y)
        self.send_response(200)
        self.end_headers()
        self.wfile.write('touched.')
        
    def do_screenshot(self):
        screen_num=0
        image = crtcScreenshot(screen_num)

        imgByteArr = io.BytesIO()
        image.save(imgByteArr, format='PNG')
        imgByteArr = imgByteArr.getvalue()

        self.send_response(200)
        self.end_headers()

        self.wfile.write(imgByteArr)

        
    def do_icon(self):
        with open('icon16.png', 'rb') as fo:
            data = fo.read()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(data)
        
    def do_GET(self):
        if not self.authenticated():
            return
        if self.path == '/icon':
            return self.do_icon()
        if self.path == '/screenshot':
            return self.do_screenshot()
        if self.path.startswith('/click'):
            params = dict( kv.split('=') for kv in self.path.split('?')[1].split('&') )
            for k,v in params.items():
                params[k] = int(v)
            print 'parsed params', params
            return self.do_click(params['x'], params['y'])
        print 'get',self.path
        body = 'OKOKOK'
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)

httpd = SocketServer.TCPServer(('127.0.0.1', settings['port']), Handler, bind_and_activate=False)
httpd.allow_reuse_address = True
httpd.server_bind()
httpd.server_activate()
httpd.serve_forever()
