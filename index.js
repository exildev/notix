var http = require('http');
var server = http.createServer();
var io = require('socket.io')(server);
var session = require('./session');
var listening = require('./listening');
var url = require('url');
var request = require('request');
var verifing = {};

listening.setup(function(){
	listening.reset();
	io.on('connection', function(socket) {
			socket.on('identify', function(message) {
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				console.log("Idd");
				var ID = session.get_session(django_id, usertype);
				socket.emit('identify', {"ID": ID});
				if (ID){
					session.clear(django_id, usertype);
					console.log("active", django_id);
					listening.update_session(ID.type, ID.webuser, django_id, socket.id);
				}
			});


			socket.on('login', function(message){
				var django_id = message['django_id'];
				var webuser = message['webuser'];
				var usertype = message['usertype'];
				var username = message['username'];
				var password = message['password'];

				if (usertype == 'WEB'){
					verifing[django_id] = socket.id;
					request('http://192.168.0.109:8000/notificaciones/verify/' + django_id + '/', function (error, response, body) {
						if (!error && response.statusCode == 200) {
							var data = JSON.parse(body);
							if (data.socket_id == socket.id){
								session.login(django_id, username, password, usertype, function (success){
									if (success){
										session.set_value(django_id, 'type', data.type, usertype);
										session.set_value(django_id, 'webuser', data.webuser, usertype);
										listening.add_session(data.type, webuser, django_id, socket.id);
										socket.on('disconnect', function(){
											console.log('disconnect', socket.id);
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
						}else
						console.log(error, response.statusCode);
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


			socket.on('save', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var send_to = message['_send_to_'];
				var key = session.get_session(django_id, usertype);
				console.log("--------------");
				if (key){
					for (var to in send_to){
						console.log(send_to[to]);
						listening.add_messages_by_type(send_to[to], [message], 
							function(django_id, socket_id, message){
								console.log('notix', socket_id, django_id, send_to[to]);
								io.to(socket_id).emit('notix', message);
						});
					}
				}
			});

			socket.on('visited', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var message_id = message['message_id'];
				var type = message['type'];
				var key = session.get_session(django_id, usertype);
				if (key){
					listening.visit_message(type, webuser, message_id, django_id, function (errors, session){
						for (var i in session.sessions){
							io.to(session.sessions[i].socket_id).emit('visited', {
								'session_id': session.sessions[i].session_id, 
								'message_id': message_id,
								'socket_id': session.sessions[i].socket_id
							});
						}
					});
				}
			});

			socket.on('messages', function(message){
				var django_id = message['django_id'];
				var usertype = message['usertype'];
				var webuser = message['webuser'];
				var type = message['type'];
				var key = session.get_session(django_id, usertype);
				if (key){
					listening.get_messages(type, webuser, function(errors, messages){
						for (var i in messages){
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

verify.listen(80, '0.0.0.0', function() {
	console.log("Corriendo en el puerto ", 80);
});

server.listen(1196, '0.0.0.0', function() {
	console.log("Corriendo en el puerto ", 1196);
});