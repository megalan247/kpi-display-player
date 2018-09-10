require('dotenv').config();
const electron = require('electron');
const {app, BrowserWindow} = electron;
const request = require('request');
const fs = require('fs');
const pug = require('pug');
const express = require('express');
const expressApp = express();
const si = require('systeminformation');
const os = require('os');
var spawn = require('child_process').spawn;
var schedule = require('node-schedule');
var is_error = false;


function updateInventory() {

  si.system(function(data) {
    var formData = {
      id: process.env.PLAYER_ID,
      name: os.hostname(),
      playerType: data.manufacturer + " " + data.model,
      serialNumber: data.serial,
      OSName: os.platform(),
      OSVersion: os.release(),
      macAddress: "NOT IMPLIMENTED",
      freeSpace: "NOT IMPLIMENTED",
      cpu: "NOT IMPLIMENTED",
    }  
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/updatePlayer', form: formData} , function(err,httpResponse,body){
      if (err) {
        console.log("Unable to update. " + err)
      }
    });
  });
}

function updateApp() {
  try {
    var prc = spawn('git',  ['reset --hard']);
    prc.stdout.setEncoding('utf8');
    prc.stdout.on('data', function (data) {
        var str = data.toString()
        var lines = str.split(/(\r?\n)/g);
        console.log(lines.join(""));
    });
    prc.on('close', (code) => {
      var pull = spawn('git',  ['pull']);
      pull.stdout.setEncoding('utf8');
      pull.stdout.on('data', function (data) {
          var str = data.toString()
          var lines = str.split(/(\r?\n)/g);
          console.log(lines.join(""));
      });
    }); 
  } catch (error) {
    console.log("Unable to update");
  }
}

function executeJavaScriptInBrowser(browser, site) {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getJavaScript/' + site.site_id, function(err,httpResponse,body){
    var parsedResponse = JSON.parse(body);
    var combinedJSString;
      for(var k in parsedResponse) {
      if(k == 0) {
        combinedJSString = parsedResponse[k].js_command
      } else {
        combinedJSString += parsedResponse[k].js_command
      } 
      
    };

    if (combinedJSString) {
      browser.webContents.executeJavaScript("document.getElementById('webview" + site.site_position + "').addEventListener('did-finish-load', () => {document.getElementById('webview" + site.site_position + "').executeJavaScript(\"" + combinedJSString + "\")});");
      
      console.log("document.getElementById('webview" + site.site_position + "').addEventListener('did-finish-load', () => {document.getElementById('webview" + site.site_position + "').executeJavaScript(\"" + combinedJSString + "\")});");
      browser.webContents.executeJavaScript("document.getElementById('webview" + site.site_position + "').addEventListener('did-frame-navigate', () => {document.getElementById('webview" + site.site_position + "').executeJavaScript(\"" + combinedJSString + "\")});");  
    }
    if (process.env.DEBUG == "Y") {
      browser.webContents.executeJavaScript("document.getElementById('webview" + site.site_position + "').openDevTools();")
    }
    });
}


function setCookies(browser, site) {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getCookies/' + site.site_id, function(err,httpResponse,body){
    var parsedResponse = JSON.parse(body);
    for(var k in parsedResponse) {
      browser.webContents.session.cookies.set({url: parsedResponse[k].cookie_url, name: parsedResponse[k].cookie_name, value: parsedResponse[k].cookie_value}, function(error) {
      });
    }; 
  });

}

function assignSites(screen, electronScreen) {
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getSites/' + screen.screen_id, function(err,httpResponse,body){
    if (err) throw err;
    var parsedResponse = JSON.parse(body);
    var browser = new BrowserWindow({
      fullscreen: true, 
      frame: false,
      x: electronScreen.bounds.x + 50,
      y: electronScreen.bounds.y + 50
    })
    try {
      var renderedHTML = pug.renderFile('./layouts/layout' + screen.screen_layout + '.pug', {main: JSON.parse(body)});
      browser.loadURL('data:text/html;charset=utf-8,' + encodeURI(renderedHTML));
      for(var site in parsedResponse) {
        setCookies(browser, parsedResponse[site]);
        executeJavaScriptInBrowser(browser, parsedResponse[site]);
      }


      
    } catch(error) {
      displayErrorScreen("Unable to render HTML for page. Check you have enough sites added and refresh the config.", error, electronScreen)
    }

  });
}

function initializeScreens(playerConfig) {
  screenArray = electron.screen.getAllDisplays();
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getScreens/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    if (err) {
      displayErrorScreen("Error when gettign config for player ID " + process.env.PLAYER_ID, err);
    } else {
      var configFromServer = JSON.parse(body);

      screenArray.forEach(function(scr) {
        if (configFromServer.length == 0) { // If there are no screens associated with this player for some reason, register this screen.
          try {
            registerScreen(scr);
          } catch(err) {
            displayErrorScreen("Error when registering screen to server. Is there a screen to register?", err);
            console.log("Error when registering screen to server. Is there a screen to register?", err);
          }
        }
        try {
          for(var k in configFromServer) { // Otherwise just get and assign screens based on electronScreenId
            if (configFromServer[k].screen_electronScreenId == scr.id) {
                assignSites(configFromServer[k], scr);
            }
          }
        } catch(err) {
          displayErrorScreen("Error in initilizing screens, please check your screen config.", err);
        }

      });



    }

      
  })
}

function registerScreen(electronScreen) {
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerScreen', form: {electronId: electronScreen.id, playerID: process.env.PLAYER_ID}} , function(err,httpResponse,body){
      if (err) {
        throw err;
      } else {
        var parsedRespose = JSON.parse(body);
        assignSites(parsedRespose, electronScreen)
      }
    });
}

function displayErrorScreen(errorbody, err, electronScreen) {

  // This function is the err rscreen dipslayer. It gracefully displays error screens 
  // if there is a problem with the display. In teh future it will also report errors
  // to the management server.
  // If electronScreen is defined it will only open an error screen on that screen
  // If not it will open on all screens.


  // This gets the IP addresses of the network cards on the system to display on teh screen
  try {
    var interfaces = os.networkInterfaces();
    var addresses = [];
    for (var k in interfaces) {
        for (var k2 in interfaces[k]) {
            var address = interfaces[k][k2];
            if (address.family === 'IPv4' && !address.internal) {
                addresses.push(address.address);
            }
        }
    }
    is_error = true;
    BrowserWindow.getAllWindows().forEach(function(item) {
      item.close();
    });
    if (electronScreen) {
      var browser = new BrowserWindow({
        fullscreen: true, 
        frame: false,
        x: electronScreen.bounds.x + 50,
        y: electronScreen.bounds.y + 50
      });
      var renderedHTML = pug.renderFile('./layouts/error.pug', {errorbody: errorbody, err: err, ips: addresses});
      browser.loadURL('data:text/html;charset=utf-8,' + encodeURI(renderedHTML));
    } else {
      electron.screen.getAllDisplays().forEach(function(item) {
        var browser = new BrowserWindow({
          fullscreen: true, 
          frame: false,
          x: item.bounds.x + 50,
          y: item.bounds.y + 50,
          alwaysOnTop: true
        });
        var renderedHTML = pug.renderFile('./layouts/error.pug', {errorbody: errorbody, err: err, ips: addresses});
        browser.loadURL('data:text/html;charset=utf-8,' + encodeURI(renderedHTML));
    });
    }
  } catch (error) {
    throw error;
  }
}

function processConfig() {
  // This process checks that the device is ready to be used.
  // This also fires the "updateInventory" command and sets up 
  // the 8 minute timer for inventory updating.
  // This function also creates cron jobs to turn off the monitors 
  // automatically at certain times. This is to save power
  request('http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/getPlayer/' + process.env.PLAYER_ID, function(err,httpResponse,body){
    if (err) {
        displayErrorScreen("Unable to connect to management server, please check your internet connection and try again.", err);
    } else {
      initializeScreens(JSON.parse(body));
      if(process.env.DEBUG !== "Y") {
        updateInventory();
        setInterval(updateInventory, 30000);
        setInterval(updateApp, 3600000);
        schedule.scheduleJob('0 7  * * 1-5', powerOnMonitors);
        schedule.scheduleJob('0 19 * * 1-5', powerOffMonitors);
      }
      
    }

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

    // POST Data to server to rgister player in database. In the future
    // we can impliment some kind of adoption process to authorize a player to be registered
    // however for now it just accepts any request. 
    
    request.post({url: 'http://' + process.env.HOST + ':' + process.env.HOST_PORT + '/api/v1/registerPlayer', form: formData} , function(err,httpResponse,body){
      if (err) {
        // If the managemetn server cannot be contacted, display an error screen explaining whats up
        displayErrorScreen("Error when registering player, please check your internet connection and try again. Error details: " + err);
      } else {
        // Then appends the requested player ID to the environment file to persisit the ID
        fs.appendFile('.env', "\nPLAYER_ID=" + JSON.parse(body).id, function (err) {
          if (err) {
            displayErrorScreen("Error when writing .env file data. Please check permissions for this file. Error details: " + err);
          } else {
            console.log('Updated .env file with player id');
            require('dotenv').config(); //Reaquire configuration from .env file
            electron.screen.getAllDisplays().forEach(function(item) {

              //For every screen it will register the screen 
              // as a new screen, then the registerScreen event will show a default webpage
              // which can then be reconfigured in the management console

              // If it fails for ehatever reason trows an error and displays error screen
              try {
                registerScreen(item);
              } catch(err) {
                displayErrorScreen("Error when registering screens. ", err);
              }
            });
          }
             

        });
    }

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
  if (is_error == false) {
    processConfig();
  }  
})

app.on('uncaughtException', function(err) {
  displayErrorScreen("Uncaught exception, check console logs.");
  console.log(err);
});

function updateConfig(req, res) {
    res.send({result: "SUCCESS"});
    BrowserWindow.getAllWindows().forEach(function(item) {
      item.close();
    });
}

function upgradeApplication(req, res) {
  var spawn = require('child_process').spawn;
  var prc = spawn('git',  ['pull']);
  
  //noinspection JSUnresolvedFunction
  prc.stdout.setEncoding('utf8');
  prc.stdout.on('data', function (data) {
      var str = data.toString()
      var lines = str.split(/(\r?\n)/g);
      console.log(lines.join(""));
  });
  res.send({result: "success"});
}

function powerOffMonitors() {
  try {
    if (os.platform() == "win32") {
      spawn(__dirname + '\\bin\\nircmdc.exe',  ['monitor', 'off']);
    } else if (os.platform() == "linux") {
      spawn('/usr/bin/vcgencmd',  ['display_power', '0']);
    }
  } catch (error) {
    console.log("Unable to update monitors.")
  }
};

function powerOnMonitors() {
  try {
    if (os.platform() == "win32") {
      spawn('shutdown',  ['-r', '-t', '0', '-f']);
    } else if (os.platform() == "linux") {
      spawn('/usr/bin/vcgencmd',  ['display_power', '1']);
    }
  } catch (error) {
    console.log("Unable to turn on monitor!")
  }

}

expressApp.get('/update', updateConfig);
expressApp.get('/upgrade', upgradeApplication);
expressApp.get('/quit', (req, res) => {res.send({result: "SUCCESS"}); process.exit()});


expressApp.listen(4000, () => console.log('Player listening on port 4000 for commands'));