var express = require('express');
var cheerio = require('cheerio');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var url = require("url"); 
var superagent = require('superagent');

const HOST = 'https://www.v2ex.com';
const LOGIN_PATH = HOST+'/signin';
const RECENT_PATH = HOST+'/recent';
const PAGE_SIZE = 50;

var app = express();
app.use(cookieParser());
app.use(bodyParser());

//请求tab列表
app.get('/',function(req,res,next){
	var query = url.parse(req.url,true).query;
	var tab = query['tab'];
	var pageIndex = getPageIndex(req);
	var cookie = req.cookies.PB3_SESSION
	console.log('/->PB3_SESSION='+cookie);
	superagent.get(HOST)
	.query({'tab':tab})
	.query({'p':pageIndex})
	.set('Cookie','PB3_SESSION='+cookie)
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);

		var response = {};
		response.hasNextPage = false;
		var msg = $('.message').text();
		response.message = msg==null?"":msg;
		response.posts = parsePost($);
		console.log(sres.headers['set-cookie']);
		res.setHeader('Set-Cookie',sres.headers['set-cookie']);
		res.send(response);
	});
});

//某个主题下的帖子列表
app.get('/go/*',function(req,res,next){
	var path = url.parse(req.url,true).pathname;
	var pageIndex = getPageIndex(req);
	console.log("path: "+path+" p: "+pageIndex);
	superagent.get(HOST+path)
	.query({'p':pageIndex})
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var node = $('title').text().replace('V2EX ›','').replace(/\s+/g,"");
		var response = {};
		var posts = [];
		$('#TopicsNode').children().each(function(idx,element){
			var $element = $(element);
			posts.push({
			avatarUrl: $element.find('img').attr('src').replace('//',"http://"),
			auther: $element.find('span').filter('.small.fade').text().split('•')[0]==null?"":$element.find('span').filter('.small.fade').text().split('•')[0].replace(/\s+/g,""),
			title: $element.find('span').filter('.item_title').children().text(),
			postPath: $element.find('span').filter('.item_title').children().attr('href').replace(/#.*/,"").replace('/t/',''),
			node: node,
			nodePath: path.replace('/go/',''),
			replyCount: parseInt($element.find('a').filter('.count_livid').text()==null?'0':$element.find('a').filter('.count_livid').text()),
			lastedReplyTime: $element.find('span').filter('.small.fade').text().split('•')[1]==null?"":$element.find('span').filter('.small.fade').text().split('•')[1].replace(/\s+/g,"")
		});
		});
		response.posts = posts;
		response.hasNextPage = response.posts.length>=20?true:false;
		response.message = "";
		res.send(response);
	});
});

app.get('/recent',function(req,res,next){
  console.log('Cookies:', req.cookies['A2'])
	var pageIndex = getPageIndex(req);
	console.log(pageIndex);
	superagent.get(RECENT_PATH)
	.query({'p':pageIndex})
	.set('cookie','A2='+req.cookies['A2'])
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var response = {};
		var msg = $('.message').text();
		response.message = msg==null?"":msg;
		response.posts = parsePost($);
		response.hasNextPage = response.posts.length>=20?true:false;
		res.send(response);
	});
});
//帖子内容
app.get('/t/*',function(req,res,next){
	var path = url.parse(req.url,true).pathname;
	console.log(path);
	superagent.get(HOST+path)
	.set('cookie','A2='+req.cookies['A2'])
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var response = {};
		var $header = $('div.header');
		response.avatarUrl = $header.find('img').attr('src').replace('//','http://');
		response.auther = $header.find('img').parent().attr('href').replace('/member/','');
		response.title = $header.find('h1').text();
		response.node = $header.find('a').eq(2).text();
		response.nodePath = $header.find('a').eq(2).attr('href').replace('/go/','');
		response.status = $header.find('small').text();
		response.text = $('div.topic_content').html();
		response.once = $('input[name=once]').attr('value')==undefined?"":$('input[name=once]').attr('value');
		console.log(sres.headers['set-cookie']);
		res.setHeader('Set-Cookie',sres.headers['set-cookie']);
		res.send(response);
	});
});
//帖子评论列表
app.get('/comments/*',function(req,res,next){
	var path = url.parse(req.url,true).pathname.replace('/comments/','/t/');
	console.log(path);
	var pageIndex = getPageIndex(req);
	superagent.get(HOST+path)
	.query({'p':pageIndex})
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var response = {};
		var comments = [];
		$('div#Main').find('div').filter('.box').eq(1).children().each(function (idx,element){
			var $element = $(element);
			if ($element.attr('id')!=null) {
				comments.push({
					avatarUrl: 'http:'+$element.find('img').attr('src'),
					no: $element.find('span').filter('.no').text(),
					auther: $element.find('a').filter('.dark').text(),
					createdTime: $element.find('span').filter('.fade.small').text(),
					content: $element.find('div').filter('.reply_content').html()
				});
			}
		});
		response.comments = comments;
		response.hasNextPage = comments.length>=100;
		res.send(response);
	});
});

app.get('/signin',function(req,res,next){
	var cookie = req.cookies.PB3_SESSION
	console.log('get/signin->PB3_SESSION='+cookie);
	superagent.get(LOGIN_PATH)
	.set('Cookie','PB3_SESSION='+cookie)
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var once = $('input[name=once]').attr('value');
		var input_name = $('input[placeholder=用户名或电子邮箱地址]').attr('name');
		var input_psw = $('input[type=password]').attr('name');

		var body = {};
		body['nameKey'] = input_name;
		body['pswKey'] = input_psw;
		body['once'] = once;
		body['next'] = '/';
		console.log('get/signin->setCookie'+sres.headers['set-cookie']);
		res.setHeader('Set-Cookie',sres.headers['set-cookie']);
		res.send(body);
		// superagent.post(LOGIN_PATH)
  //   	.type('form')
  //   	.send(body)
  //   	.set('Cookie',cookie)
  //  		.end(function(err,loginRes){
  //   		res.send(loginRes);
  // 		});
	});
});

app.post('/signin',function(req,res,next){
	var body = req.body;
	var cookie = req.cookies.PB3_SESSION
	console.log('post/signin->PB3_SESSION='+req.cookies);
	console.log(body);	

	superagent.post(LOGIN_PATH)
    .type('form')
    .set('Cookie','PB3_SESSION='+cookie)
    .send(body)
   	.end(function(err,sres){
   		console.log('post/signin->setCookie'+sres.headers['set-cookie']);
		res.setHeader('Set-Cookie',sres.headers['set-cookie']);
    	res.send(sres);

  	});
});

app.post('/t/*',function(req,res,next){
	var path = url.parse(req.url,true).pathname;
	console.log(HOST+path);
	var cookie = req.cookies;
	console.log(cookie.A2);
	console.log(cookie.PB3_SESSION);
	var body = req.body;
	console.log(body);

	superagent.post(HOST+path)
	.type('form')
	.set('Cookie','A2='+cookie.A2+';PB3_SESSION=2|1:0|10:1479371817|11:PB3_SESSION|40:djJleDoxMTUuMjM2LjE2MS42Nzo5NTAwMDY4Nw==|b56f8d9c0795320e9bd3e57728b38b910eabc51269a44ee39ba1314c81b38501')
	//.set('Cookie','A2=2|1:0|10:1479348497|2:A2|56:MGVhMTU2YWM5ZDFmMzM4NjRiYzE5NDgzMjAyMGMxNDRiOGVjNWM5OQ==|11d244b4071f6ff86e405dc989a891034a1cc52a0b422193c143d1d9473e7633;PB3_SESSION=2|1:0|10:1478857952|11:PB3_SESSION|40:djJleDoxMTUuMjM2LjE2MS42Nzo4NTM4MDgzNA==|dae3409ac4fd2fe8621db3db1051a3d6f611c18f2d96433306ff4a44c2d6cf08')
	.send(body)
	.end(function(err,sres){
		var $ = cheerio.load(sres.text);
		var once = $('input[name=once]').attr('value');
		res.send(once);
	});
});

function parsePost($){
	var artices = [];
	$('.cell.item').each(function (idx,element){
		var $element = $(element);
		artices.push({
			avatarUrl: $element.find('img').attr('src').replace('//',"http://"),
			auther: $element.find('span').filter('.small.fade').text().split('•')[1]==null?"":$element.find('span').filter('.small.fade').text().split('•')[1].replace(/\s+/g,""),
			title: $element.find('span').filter('.item_title').children().text(),
			postPath: $element.find('span').filter('.item_title').children().attr('href').replace(/#.*/,"").replace('/t/',''),
			node: $element.find('a').filter('.node').text(),
			nodePath: $element.find('a').filter('.node').attr('href').replace('/go/',''),
			replyCount: parseInt($element.find('a').filter('.count_livid').text()==null?'0':$element.find('a').filter('.count_livid').text()),
			lastedReplyTime: $element.find('span').filter('.small.fade').text().split('•')[2]==null?"":$element.find('span').filter('.small.fade').text().split('•')[2].replace(/\s+/g,"")
		});
	});
	return artices;
}

function hasNextPage(artices){
	return artices.length>=PAGE_SIZE?true:false;
}

function isContain(str,subStr){
	return str.indexOf(subStr)>=0;
}

function getPageIndex(req){
	var query = url.parse(req.url,true).query;
	return pageIndex = query['p']==undefined?'1':query['p'];
}

app.listen(3000,function(){
	console.log('app is listening at port 3000');
});