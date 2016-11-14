var express = require('express');
var cheerio = require('cheerio');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var url = require("url"); 
var superagent = require('superagent').agent();

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
	superagent.get(HOST)
	.query({'tab':tab})
	.query({'p':pageIndex})
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var response = {};
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
		response.hasNextPage = false;
		var msg = $('.message').text();
		response.message = msg==null?"":msg;
		response.posts = artices;
		res.send(response);
	});
});

app.get('/recent',function(req,res,next){
  console.log('Cookies: ', req.cookies['A2'])
	var pageIndex = getPageIndex(req);
	superagent.get(RECENT_PATH)
	.query({'p':pageIndex})
	.set('cookie','A2='+req.cookies['A2'])
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var response = {};
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
		response.hasNextPage = hasNextPage(artices);
		var msg = $('.message').text();
		response.message = msg==null?"":msg;
		response.posts = artices;
		res.send(response);
	});
});
//帖子内容
app.get('/t/*',function(req,res,next){
	console.log(url.parse(req.url,true).path);
	var path = url.parse(req.url,true).path
	superagent.get(HOST+path)
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
		res.send(response);
	});
});
//帖子评论列表
app.get('/comments/*',function(req,res,next){
	console.log(url.parse(req.url,true).path);
	var path = url.parse(req.url,true).path.replace('/comments/','/t/');
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
	superagent.get(LOGIN_PATH)
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var once = $('input[name=once]').attr('value');
		var input_name = $('input[placeholder=用户名或电子邮箱地址]').attr('name');
		var input_psw = $('input[type=password]').attr('name');
		var cookie = sres.headers['set-cookie'].join(';').split(';')[0].replace('PB3_SESSION=','').replace('"','').replace('"','');
        console.log(cookie);

		var body = {};
		body[input_name] = '1057645164@qq.com';
		body[input_psw] = '149162536max';
		body['once'] = once;
		body['next'] = '/';

		superagent.post(LOGIN_PATH)
    	.type('form')
    	.send(body)
    	.set('Cookie','PB3_SESSION='+cookie)
   		.end(function(err,loginRes){
    		res.send(loginRes);
    	// var loginCookie = sres.header['set-cookie'];
    	// console.log(loginCookie.toString());
    	// superagent.get(HOST+'/recent')
    	// .set('cookie',loginCookie.toString())
   		// .end(function(err,recentRes){
   		// 	res.send(recentRes);
   		// });
  		});

	});
});

app.post('/signin',function(req,res,next){
	var body = req.body;
	var cookie = req.cookies['PB3_SESSION'];
	console.log(cookie);
	console.log(body);	

	superagent.post(LOGIN_PATH)
    .type('form')
    .set('cookie','PB3_SESSION='+cookie)
    .send(body)
   	.end(function(err,loginRes){
    	res.send(loginRes);
    	// var loginCookie = sres.header['set-cookie'];
    	// console.log(loginCookie.toString());
    	// superagent.get(HOST+'/recent')
    	// .set('cookie',loginCookie.toString())
   		// .end(function(err,recentRes){
   		// 	res.send(recentRes);
   		// });
  	});
});

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