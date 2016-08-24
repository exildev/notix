



module.exports = {
	alarms : [],

	add_alarm: function(usertype, webuser, time, message, hora, callback){
		var timer = setTimeout(function (){
			var index = this.alarms.indexOf(timer);
			callback(index, hora);
			this.alarms.splice(index, 1);
		}.bind(this), time);

		this.alarms.push({
			'timer':timer,
			'webuser': webuser,
			'usertype': usertype,
			'time': time,
			'message': message
		});
	},

	show_alarms(usertype, webuser, callback){
		var alms = [];
		for (var i in alarms){
			if (alarms[i]['webuser'] == webuser && alarms[i]['usertype'] == usertype){
				alms.push(alarms[i]);
			}
		}
		callback(alms);	
	}
};