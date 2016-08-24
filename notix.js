var http = require('http');
var server = http.createServer();
var io = require('socket.io')(server);
var session = require('./session');
var listening = require('./listening');
var alarms = require('./alarms');
var url = require('url');
var request = require('request');
var verifing = {};
var HOST = '104.236.33.228';
var PORT = 8050;
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



listening.setup('test', HOST, PORT, 
	function(django_id, socket_id, message){
		//log('notix', socket_id, django_id);
		io.to(socket_id).emit('notix', message);
	},

	function(){
	io.on('connection', function(socket) {

			socket.on('identify', function(message) {
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var ID = session.get_session(django_id, usertype);
				socket.emit('identify', {"ID": ID});
				log(message, 'identify', ID);
				if (ID){
					session.clear(django_id, usertype);
					listening.update_session(ID.type, ID.webuser, django_id, socket.id);
				}
			});


			socket.on('login', function(message){
				var django_id = message['django_id'];
				var webuser = message['webuser'];
				var usertype = message['usertype'];
				var username = message['username'];
				var password = message['password'];
				console.log('login', webuser, django_id);

				if (usertype == 'WEB'){
					verifing[django_id] = socket.id;
					request('http://' + HOST + ':' + PORT + '/notificaciones/verify/' + django_id + '/', function (error, response, body) {
						if (!error && response.statusCode == 200) {
							var data = JSON.parse(body);
							if (data.socket_id == socket.id){
								session.login(django_id, username, password, usertype, function (success){
									if (success){
										session.set_value(django_id, 'type', data.type, usertype);
										session.set_value(django_id, 'webuser', data.webuser, usertype);
										listening.add_session(data.type, webuser, django_id, socket.id);
										socket.on('disconnect', function(){
											log('disconnect', socket.id);
											listening.delete_session(data.type, webuser, django_id);
										});
										socket.emit('success-login');
									}else{
										socket.emit('error-login');
									}
								});
							}else{
								socket.emit('error-login');
							}
						}else{
							if (response){
								log(error, response.statusCode, 'http://' + HOST + ':' + PORT + '/notificaciones/verify/' + django_id + '/');
							}else{
								log(error);
							}
						}
					});
				}else {
					session.login(django_id, username, password, usertype, function (success){
						if (success){
							socket.emit('success-login');
						}else{
							socket.emit('error-login');
						}
					});
				}

			});

			socket.on('cron', function(message){
				listening.get_today_crons();
			});

			socket.on('save', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var send_to = message['_send_to_'];
				var exclude = message['exclude'];

				var key = session.get_session(django_id, usertype);
				log("save", message, key);
				console.log("save", message);
				if (key){
					for (var to in send_to){
						log(send_to[to]);
						listening.add_messages_by_type(send_to[to], [message], 
							function(django_id, socket_id, message){
								log('notix', socket_id, django_id, send_to[to]);
								io.to(socket_id).emit('notix', message);
						}, exclude);
					}
				}
			});
			socket.on('user', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webusers = message['webuser'];
				var send_to = message['_send_to_'];
				var key = session.get_session(django_id, usertype);
				log("user", JSON.stringify(key));

				if (key){
					for (var i in webusers){
						log(send_to, webusers[i], JSON.stringify(message));
						listening.add_messages(send_to, webusers[i], [message], 
							function(django_id, socket_id, message){
								log('notix', socket_id, django_id, send_to);
								io.to(socket_id).emit('notix', message);
							}
						);
					}
				}
			});

			socket.on('visited-path', function(message) {
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var path = message['path'];
				var type = message['type'];
				var key = session.get_session(django_id, usertype);

				if (key){
					console.log("visit me");
					listening.visit_messages_by_path(type, webuser, path, django_id, function (errors, session, messages_id){
						for (var i in session.sessions){
							console.log("visit you", session.webuser, session.sessions[i].session_id, session.sessions[i].socket_id);
							io.to(session.sessions[i].socket_id).emit('visited', {
								'session_id': session.sessions[i].session_id, 
								'messages_id': messages_id,
								'socket_id': session.sessions[i].socket_id
							});
						}
					});
				}
			});

			socket.on('visited', function(message) {
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var messages_id = message['messages_id'];
				var type = message['type'];
				var key = session.get_session(django_id, usertype);

				if (key){
					console.log("visit me");
					listening.visit_messages(type, webuser, messages_id, django_id, function (errors, session){
						for (var i in session.sessions){
							console.log("visit you", session.webuser, session.sessions[i].session_id, session.sessions[i].socket_id);
							io.to(session.sessions[i].socket_id).emit('visited', {
								'session_id': session.sessions[i].session_id, 
								'messages_id': messages_id,
								'socket_id': session.sessions[i].socket_id
							});
						}
					});
				}
			});

			socket.on('alarm', function (message) {
				var time = message['time'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var message = message['message'];
				console.log("message");
				alarms.add_alarm(usertype, webuser, time, message, function(){
					console.log(usertype, webuser, [message]);
					listening.add_messages(usertype, webuser, [message], 
						function(django_id, socket_id, message){
							console.log("send");
							io.to(socket_id).emit('notix', message);
						});
				});
			});

			socket.on('show-alarm', function (message) {
				var time = message['time'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				alarms.show_alarm(usertype, webuser, function(messages){
					socket.emit('list-alarms', messages);
				});
			});

			socket.on('messages', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var type = message['type'];
				var key = session.get_session(django_id, usertype);
				console.log("messages", type, webuser, key);
				if (key){
					listening.get_messages(type, webuser, function(errors, messages){
						for (var i in messages){
							console.log('message', messages[i]);
							socket.emit('notix', messages[i]);
						}
					});
				}
			});
	});

});

var verify = http.createServer(function(request, response) {
	response.setHeader('Content-Type', 'text/html');
	response.writeHead(200, {'Content-Type': 'text/plain'});
	var parts = url.parse(request.url, true);
	if (request.method == 'GET') {
		var socket_id = verifing[parts.query['data']];
		response.end(socket_id);
	}
});


function hash(username, password, usertype){
	return new Buffer(username+'/'+password + '/' + usertype).toString('base64')
}

verify.listen(1192, '0.0.0.0', function() {
	log("Corriendo en el puerto ", 1192);
});

server.listen(1196, '0.0.0.0', function() {
	log("Corriendo en el puerto ", 1196);
});
