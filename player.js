require('dotenv').config();
const electron = require('electron');
const {app, BrowserWindow, session} = electron;
const request = require('request');
const serialNumber = require('serial-number');
const fs = require('fs');
const bodyParser = require("body-parser");
const pug = require('pug');

function createWindow () {
  var screenArray = electron.screen.getAllDisplays();
  console.log(screenArray);
  serialNumber(function (err, value) {
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerPlayer', form: {name:value}} , function(err,httpResponse,body){
      console.log(body);
     })
  });
}

function registerNewScreen() {

}

function reportDisabledScreen(screenID, electronID) {
  console.log("Reporting disabled screen" + screenID);
}

function setCookies(browser, sites) {
  for(var site in sites) {
    request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getCookies/' + sites[site].site_id, function(err,httpResponse,body){
      var parsedResponse = JSON.parse(body);
      for(var k in parsedResponse) {
        browser.webContents.session.cookies.set({url: parsedResponse[k].cookie_url, name: parsedResponse[k].cookie_name, value: parsedResponse[k].cookie_value}, function(error) {
          console.log(error);
        });
        console.log({url: parsedResponse[k].cookie_url, name: parsedResponse[k].cookie_name, value: parsedResponse[k].cookie_value})
      }; 
    });
  }

  browser.openDevTools();

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
  displayedScreenArray = [];
  screenArray = electron.screen.getAllDisplays();
  console.log(screenArray);
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getScreens/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    var screenConfig = JSON.parse(body);
    for(var k in screenConfig) {
      screenArray.forEach(function(scr) {
        if (screenConfig[k].screen_electronScreenId == scr.id) {
          assignSites(screenConfig[k], scr)
        } else {
          console.log("Screen not matched.")
        }
      });
    }
      
  })
}

function displayAdoptionScreen(body) {
  electron.screen.getAllDisplays().forEach(function(item) {
    new BrowserWindow({
      fullscreen: true, 
      frame: false,
      x: item.bounds.x + 50,
      y: item.bounds.y + 50
    })
      .loadURL('data:text/html;charset=utf-8,' + encodeURI(pug.renderFile('./layouts/new_adopt.pug', {
          id: body.id,
          screenId: item.id
        })));
   });
}

function processConfig() {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getPlayer/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    initializeScreens(JSON.parse(body));
  })
}

function getConfig() {
  if (!process.env.HOST) {
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
        });
        displayAdoptionScreen(JSON.parse(body));
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
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.