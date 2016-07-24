var mongoose = require('mongoose');
var tasks = require('node-schedule');
var request = require('request');
var fs = require('fs');

function log(){
	var message = '\n';
	for (var i=0; i < arguments.length; i++) {
        message += arguments[i] + ', ';
    }
    console.log(message);
	fs.appendFile('node.log', message, function (err) {
	  if (err) throw err;
	});
}

module.exports = {
	schedule : {},
	cron_stop: false,
	HOST: 'localhost',
	PORT: '80',


	setup: function (db, HOST, PORT, callback){
		this.HOST = HOST;
		this.PORT = PORT;
		mongoose.connect('mongodb://localhost/' + db);
		var db = mongoose.connection;
		db.on('error', console.error.bind(console, 'connection error:'));
		db.once('open', function (){
			var message = mongoose.Schema({
				'type': String,
				'webuser': String,
				'data': Object,
				'visited': Boolean
			});
			this.Message = mongoose.model('Message', message);
			var session = mongoose.Schema({
				'type': Array,
				'webuser': String,
				'sessions': [
					{
						'socket_id': String,
						'session_id': String,
					}
				]
			});
			this.Session = mongoose.model('Session', session);

			var schedule = mongoose.Schema({
				'pk': Number,
				'start': String,
				'users': String,
				'color': String,
				'_send_to_': String,
				'type': String,
				'visited': Boolean
			});
			this.Schedule = mongoose.model('Schedule', schedule);
			

			this.get_today_crons();
			setInterval(function (){
				//console.log("check:");
				this.Schedule.find({'visited':false}, 	function(err, raw){
					raw.forEach(function (doc, index, raw) {
						var date = new Date(doc.start);
						var now = new Date();
						//console.log(now >= date);
						if (now >= date){
							doc.visited = true;
							doc.save();
							if (doc.type == 'Actividad'){
								var type = doc['_send_to_'];
								var users = doc['users'];
								if (users){
									users = users.split(',');
									for (var j in users){
										this.add_messages(type, users[j], doc);
									}
								}
							}
						}
					}.bind(this));
				}.bind(this));
			}.bind(this), 5000);
			callback();
		}.bind(this));
		
	},

	add_schedule: function(schedule){
		this.Schedule.find({'pk': schedule.pk}).count(function(err, count){
			if (count == 0){
				schedule['visited'] = false;
				var sch = new this.Schedule(schedule);
				sch.save();
			}
		}.bind(this));
	},

	get_today_crons: function(){
		var now = new Date();
		var today = now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
		request('http://' + this.HOST + ':' + this.PORT + '/notificaciones/calendar/?start=' + today + '&end=' + today, function (error, response, body) {
			var schedules = JSON.parse(body);
			for (var i in schedules){
				this.add_schedule(schedules[i]);
			}
		}.bind(this));
	},

	reset: function(){
		this.Session.remove({}).exec();
		this.Message.remove({}).exec();
	},
	update_schedule: function(type, message, cron, clazs, owner, callback) {
		this.delete_schedule(clazs, owner, function(){
			this.add_schedule(type, message, cron, clazs, owner, callback);
		}.bind(this));
	},

	add_messages_by_type: function (type, messages, callback) {
		this.Session.find({'type': type}, {}, function(err, raw){
			
			raw.forEach(function (doc, index, raw) {
				for (var i in messages) {
					var message = new this.Message({
						'type': type,
						'webuser': doc.webuser,
						'data': messages[i],
						'visited': false
					});
					message.save();
					for (var j in doc.sessions){
						if (callback){
							callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
						}
					}
				}
			}.bind(this));
		}.bind(this));
	},

	add_messages: function (type, webuser, messages, callback) {
		
		for (var i in messages){
			var message = new this.Message({'type': type, 'webuser': webuser, 'data': messages[i], 'visited': false});
			message.save();
		}

		this.Session.find({'type': type, 'webuser': webuser}, {}, function (err, raw){
			console.log('type', type, webuser, raw);
			raw.forEach(function (doc, index, raw) {
				for (var j in doc.sessions) {
					if (callback){
						callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
					}
				}
			});
		});
	},

	visit_message: function (type, webuser, message_id, session_id, callback){
		this.Message.update(
			{'_id': message_id},
			{'visited': true},
			function(err, doc){
				this.Session.findOne({'type': type, 'webuser':webuser}, function(err, doc){
					callback(err, doc);
				});
			}.bind(this)
		);
	},

	update_session: function (type, webuser, session_id, socket_id, callback){
		this.delete_session(type, webuser, session_id);
		this.add_session(type, webuser, session_id, socket_id, callback);
	},
	add_session: function (type, webuser, session_id, socket_id, callback){
		var session = this.Session.find({'type': type, 'webuser': webuser}, function(err, raw){
			if (raw.length == 0){
				var session = new this.Session({
					'type': type,
					'webuser': webuser,
					'sessions': [
						{'session_id': session_id, 'socket_id': socket_id}
					]
				});
				session.save(function (){
					if (callback){
						callback(session);
					}
				});
			}else{
				this.Session.update(
					{'type': type, 'webuser': webuser}, 
					{
						$push: {'sessions': {'session_id': session_id, 'socket_id': socket_id}}
					}
				).exec(function (){
					if (callback){
						callback(session);
					}
				});
			}
		}.bind(this));
		
	},

	get_messages: function (type, webuser, callback){
		this.Message.find({'type': type, 'webuser': webuser, 'visited': false}, callback);
	},

	get_sessions: function (type, webuser, callback){
		this.Session.find({'type': type, 'webuser':webuser}, callback);
	},

	delete_message: function (message_id){
		this.Message.remove({'_id': message_id}).exec();
	},

	delete_session: function (type, webuser, session_id){
		this.Session.update(
			{'type': type, 'webuser': webuser}, 
			{$pull: {'sessions': {'session_id': session_id}}}
		).exec();
	}

};