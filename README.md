# chromeos-unattended-remote
Get unattended remote desktop access to a chromeos device (developer mode only)

Motivation: We would like to get full unattended remote desktop access to a ChromeOS device that is in developer mode.

Approach: Nothing fancy. Assume the user of the program is in developer mode and they have a crouton installed.

## Installation:

- install crouton
- clone this repository
- install dependencies
- run python daemon
- install extension
- pair extension with daemon

## Two components

1. python server that runs in crouton (as root) that can
  - take screenshot
  - enter keystrokes
  - click on screen
2. browser extension that authenticates remote users and forwards commands to the local python server

The python server listens on localhost and needs an initial pairing with the locally installed browser extension 
(user looks in python server console for the password and puts it into the extension UI)

## Example user flow (after setup)

User clicks on extension, sees a list of remote devices. User can click on a device and see the screen. User can enter
keystrokes. User can launch "Chrome remote desktop" and click remote assistance and view code. 
User can open tab to remotedesktop.google.com and use the code to get full native desktop access.

## Signalling notes

We assume browser extensions need to connect to each other. Ideally we don't need to use any custom server infrastructure for signalling or proxying. The extension can authenticate with the `identity.email` permission in the manifest, and use `chrome.storage.sync` for signalling, and webrtc datachannel to transfer screenshots and commands.
