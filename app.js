require('dotenv').config();
const electron = require('electron');
const {app, BrowserWindow, session} = electron;
const request = require('request');
const serialNumber = require('serial-number');
const fs = require('fs');
const bodyParser = require("body-parser");
const pug = require('pug');
const express = require('express');
const expressApp = express();
const {autoUpdater} = require("electron-updater");



function setCookies(browser, sites) {
  for(var site in sites) {
    request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getCookies/' + sites[site].site_id, function(err,httpResponse,body){
      var parsedResponse = JSON.parse(body);
      for(var k in parsedResponse) {
        browser.webContents.session.cookies.set({url: parsedResponse[k].cookie_url, name: parsedResponse[k].cookie_name, value: parsedResponse[k].cookie_value}, function(error) {
          console.log(error);
        });
      }; 
    });
  }

}

function assignSites(screen, electronScreen) {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getSites/' + screen.screen_id, function(err,httpResponse,body){
    var parsedResponse = JSON.parse(body);
    var browser = new BrowserWindow({
      fullscreen: true, 
      frame: false,
      x: electronScreen.bounds.x + 50,
      y: electronScreen.bounds.y + 50
    })
    var renderedHTML = pug.renderFile('./layouts/layout' + screen.screen_layout + '.pug', {main: JSON.parse(body)});
    browser.loadURL('data:text/html;charset=utf-8,' + encodeURI(renderedHTML));
    setCookies(browser, parsedResponse);
  });
}

function initializeScreens(playerConfig) {
  screenArray = electron.screen.getAllDisplays();
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getScreens/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    var configFromServer = JSON.parse(body);
    screenArray.forEach(function(scr) {
        console.log(configFromServer.length)
        if (configFromServer.length == 0) {
            registerScreen(scr);
        }
        for(var k in configFromServer) {
            if (configFromServer[k].screen_electronScreenId == scr.id) {
                assignSites(configFromServer[k], scr);
            }
        }
    });
      
  })
}

function registerScreen(electronScreen) {
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerScreen', form: {electronId: electronScreen.id, playerID: process.env.PLAYER_ID}} , function(err,httpResponse,body){
        var parsedRespose = JSON.parse(body);
        assignSites(parsedRespose, electronScreen)
    });
}

function processConfig() {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getPlayer/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    initializeScreens(JSON.parse(body));
  })
}

function getConfig() {
  if (!process.env.HOST || !process.env.HOST_PORT) {
      console.log("No environment file specified. Please specify HOST and HOST_PORT in a .env file. Exiting.");
      process.exit();
  }
  if (!process.env.PLAYER_ID) {
    console.log("No player ID saved in env file, registering with server " + process.env.HOST + ":" + process.env.HOST_PORT);
    serialNumber(function (err, value) {
      request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerPlayer', form: {name:value}} , function(err,httpResponse,body){
        fs.appendFile('.env', "\nPLAYER_ID=" + JSON.parse(body).id, function (err) {
          if (err) throw err;
          console.log('Updated .env file with player id');
          require('dotenv').config();
          electron.screen.getAllDisplays().forEach(function(item) {
            registerScreen(item);
           });
        });
      })
    });
  } else {
    processConfig();
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', getConfig)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  getConfig();
})

function updateConfig(req, res) {
    BrowserWindow.getAllWindows().forEach(function(item) {
      item.close();
    });
}

function upgradeApplication(req, res) {
    autoUpdater.checkForUpdates();
}

autoUpdater.on('update-available', (info) => {
    appUpdater.downloadUpdate();
})

autoUpdater.on('update-downloaded', (info) => {
  autoUpdater.quitAndInstall(true, true);  
})

function rebootSystem(req, res) {
  
}

expressApp.get('/update', updateConfig);
expressApp.get('/upgrade', upgradeApplication);
expressApp.get('/reboot', rebootSystem);
expressApp.get('/quit', (req, res) => {res.send({result: "SUCCESS"}); process.exit()});


expressApp.listen(4000, () => console.log('Player listening on port 4000 for commands'))