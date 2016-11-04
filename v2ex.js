var express = require('express');
var cheerio = require('cheerio');
var superagent = require('superagent');
const HOST = 'https://www.v2ex.com/';
const LOGIN_PATH = HOST+'/signin';
const PAGE_SIZE = 50;

var app = express();

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

app.get('/signin',function(req,res,next){
	superagent.get(LOGIN_PATH)
	.end(function(err,sres){
		if (err) {
			return next(err);
		}
		var $ = cheerio.load(sres.text);
		
	});
});

function hasNextPage(artices){
	return artices.length>=PAGE_SIZE?true:false;
}

app.listen(3000,function(){
	console.log('app is listening at port 3000');
});