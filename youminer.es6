'use strict';

import fetchCommentPage from 'youtube-comment-api';
import Promise from 'bluebird';
import Mystem3 from 'mystem3';
import EventEmitter from 'events';

/**
 * Default youtube-comment-api configuration
 */
const fetchComments = fetchCommentPage({
	includeReplies: true,
	includeVideoInfo: true,
	fetchRetries: 3,
	sessionTimeout: 60 * 30,
	cacheDuration: 60 * 30
});

const mystem3 = new Mystem3();

class Events extends EventEmitter { }

const events = new Events();

export default class Youminer {
	constructor() {
		this.tokens = [];
		this.rawComments = [];
		this.lemmata = [];

		mystem3.start();
	}

	/**
	 * A method that recursively fetches a data from youtube.
	 * @param videoId
	 * @param token
	 */
	fetchYoutubeData(videoId, token) {
		fetchComments(videoId, token || 0, (error, result) => {
			if (error) {
				throw error;
			}

			if (this.tokens.indexOf(result.nextPageToken) > -1) {
				events.emit('fetched');

				return false;
			}

			this.tokens.push(result.nextPageToken);

			this.rawComments.push.apply(this.rawComments, this.extractComments(result));

			this.fetchYoutubeData(videoId, result.nextPageToken);

			events.emit('more');
		});
	}

	/**
	 * A method that performs extraction of comments
	 * @param data
	 * @returns {Array}
	 */
	extractComments(data) {
		let result = [];

		for (let i = 0; i < data.comments.length; i++) {
			result.push(
				data.comments[i].commentText.split(' ')
			);
		}

		return result;
	}

	/**
	 * Method that performs lemmatizaion of a given array. Throws event "Lemmatized"
	 * @param comments
	 */
	lemmatizeComments(comments) {
		let that = this;
		let lemmata = [];

		for (var i = 0; i < comments.length; i++) {
			lemmata.push.apply(lemmata, comments[i]);

			if (comments.length - 1 === i) {
				performLemmatization(lemmata);
			}
		}

		function performLemmatization(lemmata) {
			let promises = lemmata.map(function (word) {
				return mystem3.lemmatize(word);
			});

			Promise.all(promises).then(lemmata => {
				that.lemmata = lemmata;

				events.emit('lemmatized');

				mystem3.stop();
			});
		}
	}

	/**
	 * A method that performs sorting and counting. Returns array of arrays [[value, key], [value, key], [value, key]]
	 * @param comments
	 * @returns {Array}
	 */
	sortAndCount(comments) {
		let sorted = [];

		let counted = comments.reduce((prev, cur) => {
			prev[cur] = (prev[cur] || 0) + 1;

			return prev;
		}, {});

		for (let lemma in counted) {
			if ({}.hasOwnProperty.call(counted, lemma)) {
				sorted.push([lemma, counted[lemma]]);
			}
		}

		sorted.sort((a, b) => {
			return a[1] - b[1];
		});

		return sorted;
	}

	/**
	 * A method that runs extraction, lemmatization, and sorting
	 * @param videoId
	 * @param callback
	 */
	execute(videoId, callback) {
		this.fetchYoutubeData(videoId);

		events.on('more', () => {
			callback('Loading...');
		});

		events.on('fetched', () => {
			this.lemmatizeComments(this.rawComments);
		});

		events.on('lemmatized', () => {
			let result = this.sortAndCount(this.lemmata);

			callback(result);
		});
	}
}
