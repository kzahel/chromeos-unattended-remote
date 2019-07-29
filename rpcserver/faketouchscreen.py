import time
import os
import random
from evdev import UInput, AbsInfo
from evdev.ecodes import EV_ABS, EV_KEY, \
    ABS_MT_TRACKING_ID, \
    ABS_MT_POSITION_X, \
    ABS_MT_POSITION_Y, \
    BTN_TOUCH, \
    ABS_X, \
    ABS_Y, \
    ABS_PRESSURE, \
    ABS_MT_PRESSURE
TMIN = 0.01
XMAX = 1920
YMAX = 1080
TRACKIDMAX = 65535
RES = 10
cap = {
    EV_KEY: [BTN_TOUCH],
    EV_ABS: [
        (ABS_X, AbsInfo(value=0, min=0, max=XMAX,
                        fuzz=0, flat=0, resolution=RES)),
        (ABS_Y, AbsInfo(0, 0, YMAX, 0, 0, RES)),
        (ABS_PRESSURE, AbsInfo(0, 0, 255, 0, 0, 0)),
        (ABS_MT_TRACKING_ID, AbsInfo(0, 0, TRACKIDMAX, 0, 0, 0)),
        (ABS_MT_PRESSURE, AbsInfo(0, 0, 255, 0, 0, 0)),
        (ABS_MT_POSITION_X, AbsInfo(0, 0, XMAX, 0, 0, RES)),
        (ABS_MT_POSITION_Y, AbsInfo(0, 0, YMAX, 0, 0, RES))
    ]
}

class FakeTouchscreen:
    def __init__(self):
        if not os.path.exists('/dev/uinput'):
            print 'error /dev/uinput does not exist. cannot make device'
            return
        self.d = UInput(cap, name='Fake Touchscreen', version=0x3)

    def down(self,x,y):
        trackid = int(random.random() * TRACKIDMAX)
        self.d.write(EV_ABS, ABS_MT_TRACKING_ID, trackid)
        self.d.write(EV_ABS, ABS_MT_POSITION_X, x)
        self.d.write(EV_ABS, ABS_MT_POSITION_Y, y)
        self.d.write(EV_ABS, ABS_X, x)
        self.d.write(EV_ABS, ABS_Y, y)
        self.d.write(EV_KEY, BTN_TOUCH, 1)
        self.d.write(EV_ABS, ABS_PRESSURE, 255)
        self.d.write(EV_ABS, ABS_MT_PRESSURE, 255)
        self.d.syn()

    def up(self):
        self.d.write(EV_ABS, ABS_MT_TRACKING_ID, -1)
        self.d.write(EV_KEY, BTN_TOUCH, 0)
        self.d.write(EV_ABS, ABS_PRESSURE, 0)
        self.d.write(EV_ABS, ABS_MT_PRESSURE, 0)
        self.d.syn()

    def touch(self,x,y):
        self.down(x,y)
        time.sleep(TMIN)
        self.up()
