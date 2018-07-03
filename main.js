require('dotenv').config();
const electron = require('electron');
const {app, BrowserWindow} = electron;
const request = require('request');
const serialNumber = require('serial-number');
const fs = require('fs');
const bodyParser = require("body-parser");
const pug = require('pug');
 
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let config;

let displayedScreenArray = [];

function createWindow () {
  var screenArray = electron.screen.getAllDisplays();
  console.log(screenArray);
  serialNumber(function (err, value) {
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerPlayer', form: {name:value}} , function(err,httpResponse,body){
      console.log(body);
     })
  });

  /* screenArray.forEach(function(item) { 
    new BrowserWindow({
                        fullscreen: true, 
                        frame: false,
                        x: item.bounds.x + 50,
                        y: item.bounds.y + 50,
                      });
   }); */
  // Create the browser window.
}

function initializeScreens(playerConfig) {
  displayedScreenArray = [];
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getscreens/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    var screenConfig = body;
    
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
  app.quit();
  displayedScreenArray.length = 0;
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
        console.log(body);
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