const electron = require('electron');
const {app, BrowserWindow} = electron;
const pug = require('pug');

exports.renderScreen = function(item, body) {
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
}