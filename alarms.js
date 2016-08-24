



module.exports = {
	alarms : [],

	add_alarm: function(usertype, webuser, time, message, hora, callback){
		var timer = setTimeout(function (){
			var index = this.alarms.indexOf(timer);
			callback(index);
			this.alarms.splice(index, 1);
		}.bind(this), time);

		this.alarms.push({
			'webuser': webuser,
			'usertype': usertype,
			'time': time,
			'message': message,
			'hora': hora
		});
	},

	show_alarms(usertype, webuser, callback){
		var alms = [];
		for (var i in this.alarms){
			if (this.alarms[i]['webuser'] == webuser && this.alarms[i]['usertype'] == usertype){
				alms.push(this.alarms[i]);
			}
		}
		callback(alms);	
	}
};