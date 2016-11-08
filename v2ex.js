var express = require('express');
var cheerio = require('cheerio');
var superagent = require('superagent').agent();
const HOST = 'https://www.v2ex.com';
const LOGIN_PATH = HOST+'/signin';
const PAGE_SIZE = 50;

var app = express();
app.use(require('body-parser')());

app.get('/',function(req,res,next){
	superagent.get(HOST)
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
				avatarUrl: $element.find('img').attr('src').replace('//',""),
				title: $element.find('span').filter('.item_title').children().text(),
				postPath: $element.find('span').filter('.item_title').children().attr('href').replace(/#.*/,""),
				node: $element.find('a').filter('.node').text(),
				nodePath: $element.find('a').filter('.node').attr('href'),
				replyCount: $element.find('a').filter('.count_livid').text(),
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

app.post('/signin',function(req,res,next){

	var name = req.body.name;
	var password = req.body.password;

	superagent.get(LOGIN_PATH)
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		var once = $('input[name=once]').attr('value');
		var input_name = $('input[placeholder=用户名或电子邮箱地址]').attr('name');
		var input_psw = $('input[type=password]').attr('name');
		var cookies = sres.header['set-cookie'];
		var body = {};
		body[input_name] = '1057645164@qq.com';
		body[input_psw] = '149162536max';
		body['once'] = once;
		body['next'] = '/';

		console.log('开始执行post方法');
		superagent.post(LOGIN_PATH)
    	.type('form')
    	.set('cookie','PB3_SESSION="";V2EX_LANG=zhcn;V2EX_TAB=""')
    	.set('referer','https://www.v2ex.com/signin')
    	.send(body)
    	.end(function(err,loginRes){
    		var loginCookie = 'A2="2|1:0|10:1478570076|2:A2|56:MGVhMTU2YWM5ZDFmMzM4NjRiYzE5NDgzMjAyMGMxNDRiOGVjNWM5OQ==|f4773efc3c549ff1441b1171b89e8f697f050a4bf53a15d39fb62c6ac1d18eb2"; Domain=.v2ex.com; expires=Wed, 08 Nov 2017 01:54:36 GMT; httponly; Path=/';
    		console.log(loginCookie);
    		res.send(loginRes);
    		// superagent.get(HOST+'/recent')
    		// .set('cookie',loginCookie)
    		// .end(function(err,recentRes){
    		// 	res.send(recentRes);
    		// })
  		});
	});
});

function hasNextPage(artices){
	return artices.length>=PAGE_SIZE?true:false;
}

app.listen(3000,function(){
	console.log('app is listening at port 3000');
});