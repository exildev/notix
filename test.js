var tasks = require('node-schedule');
console.log("?");
tasks.scheduleJob("* * * * 0,2,1", function (){
	console.log("ok");
});