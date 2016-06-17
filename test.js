var tasks = require('node-schedule');
console.log("?");
tasks.scheduleJob("*/5 * * * * *", function (){
	console.log("ok");
});