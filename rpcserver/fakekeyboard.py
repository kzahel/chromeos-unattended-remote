# https://github.com/torvalds/linux/blob/master/include/uapi/linux/input-event-codes.h

# modifier keys -- e.g. how to input @, &, etc.
# (from package console-info?)
# man keymaps
# zcat /usr/share/keymaps/i386/qwerty/us.kmap.gz | less


# 101 keys is standard, 104 with windows buttons
import time
import os
import random
from evdev import UInput
import evdev.ecodes as e

keynames = [l.strip() for l in open('fakekeyboard.txt').readlines()]
keys = [getattr(e, name) for name in keynames]

if False:
    keys = []
    for key in [chr(n).upper() for n in range(ord('a'), ord('z')+1)]:
        keys.append(getattr(e,'KEY_%s'%key))
    for key in [chr(n).upper() for n in range(ord('0'), ord('9')+1)]:
        keys.append(getattr(e,'KEY_%s'%key))

cap = {
    e.EV_KEY: keys,
}

TMIN = 0.01

typemap = {
    ' ':'SPACE',
}

def sm():
    time.sleep(TMIN)

class FakeKeyboard:
    def __init__(self):
        if not os.path.exists('/dev/uinput'):
            print 'error /dev/uinput does not exist. cannot make device'
            return
        self.d = UInput(cap, name='Fake Keyboard', version=0x3)

    def jskey(self, key):
        key = key.upper()
        jskeymapping = {
            'SHIFT':'LEFTSHIFT',
            ' ':'SPACE',
            '.':'DOT',
        }
        if key in jskeymapping:
            key = jskeymapping[key]
        return key
        
    def rawevent(self, event):
        key = self.jskey(event['key'])
        type = event['type'] # keydown, keyup
        upordown = 1 if type == 'keydown' else 0

        # do specal things if shift key, etc.
        # special mappings '@' => 'at' etc.
        
        code = getattr(e, 'KEY_%s' % key.upper())
        self.d.write(e.EV_KEY, code, upordown)
        self.d.syn()
        
    def press(self, key):
        key = self.jskey(key)
        code = getattr(e, 'KEY_%s' % key)
        self.d.write(e.EV_KEY, code, 1)
        self.d.syn()
        time.sleep(TMIN)
        self.d.write(e.EV_KEY, code, 0)
        self.d.syn()
        time.sleep(TMIN)

    def type(self, str):
        for char in str:
            if char in typemap:
                char = typemap[char]
            self.press(char)

    def utype(self, string, delay=TMIN):
        for c in string:
            self.uchar(c)
            time.sleep(delay)
                                                    
    #from https://gist.github.com/paulo-raca/0e772864013b88de205a
    def uchar(self, char):
        # this probably doesn't work on the login screen
        ui = self.d
        
        ui.write(e.EV_KEY, e.KEY_LEFTCTRL, 1)
        ui.syn()
        ui.write(e.EV_KEY, e.KEY_LEFTSHIFT, 1)
        ui.syn()

        ui.write(e.EV_KEY, e.KEY_U, 1)
        ui.syn()
        ui.write(e.EV_KEY, e.KEY_U, 0)
        ui.syn()

        ui.write(e.EV_KEY, e.KEY_LEFTSHIFT, 0)
        ui.syn()
        ui.write(e.EV_KEY, e.KEY_LEFTCTRL, 0)
        ui.syn()
      
        for hex_digit in '%X' % ord(char):
            keycode = getattr(e, 'KEY_%s' % hex_digit)
            ui.write(e.EV_KEY, keycode, 1)
            ui.syn()
            ui.write(e.EV_KEY, keycode, 0)
            ui.syn()

        ui.write(e.EV_KEY, e.KEY_ENTER, 1)
        ui.syn()
        ui.write(e.EV_KEY, e.KEY_ENTER, 0)
        ui.syn()

        
if __name__ == '__main__':
    kb = FakeKeyboard()
    

    for n in range(10):
        kb.press(str(n))
    for _ in range(5):
        kb.press('a')
        

