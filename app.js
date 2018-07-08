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
const si = require('systeminformation');
const os = require('os');
const sysdata = si.system();
function updateInventory() {

}

function executeJavaScriptInBrowser(browser, sites) {
  for(var site in sites) {
    request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getJS/' + sites[site].site_id, function(err,httpResponse,body){
      var parsedResponse = JSON.parse(body);
      for(var k in parsedResponse) {
        browser.webContents.session.cookies.set({url: parsedResponse[k].cookie_url, name: parsedResponse[k].cookie_name, value: parsedResponse[k].cookie_value}, function(error) {
          console.log(error);
        });
      }; 
    });
  }
}


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
    //executeJavaScriptInBrowser(browser, parsedResponse);
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
  // This process checks that the device is ready to be used.
  // This also fires the "updateInventory" command and sets up 
  // the 10 minute timer for inventory updating.
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getPlayer/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    initializeScreens(JSON.parse(body));
    updateInventory();
    setTimeout(updateInventory, 600000);
  })
}

function getConfig() {
  // Checking the .env file for host and host_port. If none are specified it quits the applicaiton
  if (!process.env.HOST || !process.env.HOST_PORT) {
      console.log("No environment file specified. Please specify HOST and HOST_PORT in a .env file. Exiting.");
      process.exit();
  }
  // Checks for player id in environment file. if no 
  //player id exisits it assumes the player has not registed
  // with the server before and automatically registers
  if (!process.env.PLAYER_ID) {
    console.log("No player ID saved in env file, registering with server " + process.env.HOST + ":" + process.env.HOST_PORT);
    // Gets the serial number as some kind of dynamic identifier
    // and sets the "name" of the player to the serial numebr of the deivce
    // SOmetimes this is the GUID of the device also
    // name, playerType, serialNumber, OSName, OSVersion, freeSpace, CPUPercentage
    var formData = {
      name: os.hostname(),
      playerType: "WAITING FOR UPDATE",
      serialNumber: "WAITING FOR UPDATE",
      OSName: os.platform(),
      OSVersion: os.release(),
      macAddress: "WAITING FOR UPDATE"
    }
    console.log(formData);
    
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerPlayer', form: formData} , function(err,httpResponse,body){
      // Then appends the requested player ID to the environment file to persisit the ID
      fs.appendFile('.env', "\nPLAYER_ID=" + JSON.parse(body).id, function (err) {
        if (err) throw err;
        console.log('Updated .env file with player id');
        require('dotenv').config(); //Reaquire configuration from .env file
        electron.screen.getAllDisplays().forEach(function(item) {

          //For every screen it will register the screen 
          // as a new screen, then the registerScreen event will show a default webpage
          // which can then be reconfigured in the management console

          registerScreen(item); 
          });
      });
    })

  } else {
    // If all required things are in the .env file it will use these to get and process the configuration from the server

    processConfig();
  }
}

// Get config once electron application is ready to be launched
app.on('ready', getConfig)

// Reopen windows when all windows are closed. Sort of "watchdog"
app.on('window-all-closed', function () {
  initializeScreens();
})

function updateConfig(req, res) {
    res.send({result: "SUCCESS"});
    BrowserWindow.getAllWindows().forEach(function(item) {
      item.close();
    });
}

function upgradeApplication(req, res) {
    autoUpdater.checkForUpdates();
    res.send({result: "CHECK_UPDATES_SUCCESS"});
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