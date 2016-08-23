



module.exports = {
	alarms : [],

	add_alarm: function(usertype, webuser, time, message) {
		var timer = setTimeout(function (){
			listening.add_messages(usertype, webuser, message);
			var index = this.alarms.indexOf(timer);
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
		for (var i in alarms){
			if (alarms[i]['webuser'] == webuser && alarms[i]['usertype'] == usertype){
				callback(alarms[i]);
			}
		}
	}
};