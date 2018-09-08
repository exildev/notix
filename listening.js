var mongoose = require('mongoose');
var tasks = require('node-schedule');
var request = require('request');
var fs = require('fs');

function log(){
	var message = '\n';
	for (var i=0; i < arguments.length; i++) {
        message += arguments[i] + ', ';
    }
    //console.log(message);
	fs.appendFile('node.log', message, function (err) {
	  if (err) throw err;
	});
}

module.exports = {
	schedule : {},
	cron_stop: false,
	HOST: 'localhost',
	PORT: '8080',


	setup: function (db, HOST, PORT, init, callback){
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
			this.Session.remove({}).exec();
			var schedule = mongoose.Schema({
				'pk': Number,
				'start': String,
				'users': String,
				'color': String,
				'_send_to_': Array,
				'type': String,
				'title': String,
				'url': String,
				'visited': Boolean
			});
			this.Schedule = mongoose.model('Schedule', schedule);
			

			this.get_today_crons();
			setInterval(function (){
				//console.log("check:");
				var now = new Date();
				if (now.getHours() == 0){
					this.get_today_crons();
				}
				this.Schedule.find({'visited':false}, 	function(err, raw){
					raw.forEach(function (doc, index, raw) {
						var date = new Date(doc.start);
						//console.log(now >= date);
						if (now >= date){
							doc.visited = true;  
							doc.save();
							if (doc.type == 'Actividad') {
								var type = doc['_send_to_'][0];
								var users = doc['users'];
								if (users){
									users = users.split(',');
									for (var j in users){
										////console.log(type, users[j], doc);
										this.add_messages(type, users[j], {
											'data': {
												'title': doc.title,
												'html': doc.title,
												'url': doc.urli
											}
										}, init);
									}
								}
							}else
							if (doc.type == 'Seguimiento' || doc.type == 'Cumple'){
								var types = doc['_send_to_'];
								if (types){
									for (var i in types){
										////console.log(types[i], doc);
										this.add_messages_by_type(types[i], {
											'data': {
												'title': doc.title,
												'html': doc.title,
												'url': doc.urli
											}
										}, init);
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
		////console.log('http://' + this.HOST + ':' + this.PORT + '/notificaciones/calendar/?start=' + today + '&end=' + today);
		request('http://' + this.HOST + ':' + this.PORT + '/notificaciones/calendar/?start=' + today + '&end=' + today, function (error, response, body) {
			console.log('#####body#####', body, error);
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

	add_messages_by_type: function (type, messages, callback, exclude) {
		this.Session.find({'type': type}, {}, function(err, raw){
			
			raw.forEach(function (doc, index, raw) {

				//console.log({'type': type}, raw);
				if (!exclude || exclude.indexOf(doc.webuser) < 0){
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
				}
			}.bind(this));
		}.bind(this));
	},

	add_messages: function (type, webuser, messages, callback) {
		
		for (var i in messages) {
			var message = new this.Message({'type': type, 'webuser': webuser, 'data': messages[i], 'visited': false});
			message.save();
		}

		this.Session.find({'type': type, 'webuser': webuser}, {}, function (err, raw){
			raw.forEach(function (doc, index, raw) {
				for (var j in doc.sessions) {
					if (callback){
						callback(doc.sessions[j].session_id, doc.sessions[j].socket_id, message);
					}
				}
			});
		});
	},

	visit_messages: function (type, webuser, messages_id, session_id, callback){
		
		this.Message.update(
			{'_id': {'$in':messages_id}},
			{'visited': true},
			{'multi': true},
			function(err, raw) {
				this.Session.findOne({'type': type, 'webuser':webuser}, function(err, doc){
					callback(err, doc);
				});
			}.bind(this)
		);
	},
	visit_messages_by_path: function (type, webuser, path, session_id, callback){
		var messages_id = [];
		this.Message.find({'type': type, 'webuser': webuser, 'visited': false, 'data.url':path}, {'_id':1}, function(err, raw){
			raw.forEach(function (doc, index, raw) {
				messages_id.push(doc.messages_id);
			});
		}.bind(this));
		
		this.Message.update(
			{'type': type, 'webuser': webuser, 'visited': false, 'data.url': path},
			{'visited': true},
			{'multi': true},
			function(err, raw) {
				this.Session.findOne({'type': type, 'webuser':webuser}, function(err, doc){
					callback(err, doc, messages_id);
				});
			}.bind(this)
		);
	},

	update_session: function (type, webuser, session_id, socket_id, callback){
		this.delete_session(type, webuser, session_id);
		this.add_session(type, webuser, session_id, socket_id, callback);
	},
	add_session: function (type, webuser, session_id, socket_id, callback){
		console.log("add session", webuser, session_id, socket_id);
		var session = this.Session.find({'type': type, 'webuser': webuser}, function(err, raw){
			//console.log("raw", raw);
			if (raw.length == 0){
				var session = new this.Session({
					'type': type,
					'webuser': webuser,
					'sessions': [
						{'session_id': session_id, 'socket_id': socket_id}
					]
				});
				session.save(function (){ 
					if (callback) {
						callback(session);
					}
				});
			}else{
				this.Session.update(
					{'type': type, 'webuser': webuser}, 
					{
						$pull: {'sessions': {'session_id': session_id}}
					}
				).exec();
				this.Session.update(
					{'type': type, 'webuser': webuser}, 
					{
						//$pull: {'sessions': {'session_id': session_id}},
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
