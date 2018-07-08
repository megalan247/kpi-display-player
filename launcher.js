var child;

function restartApp()
{
    spawn('git', ['pull']);
    child.kill();
    startApp();
    res.send('ok.');
}

function startApp()
{
    child = spawn('electron', ['main.js']);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function (data) {
        var str = data.toString()
        console.log(str);
    });
    child.on('close', function (code) {
        console.log('process exit code ' + code);
    });
}