'use strict';

var partial  = require('partial');
var unique   = require('unique-words');
var async    = require('async');

module.exports = checkChunk;

function checkChunk(nodehun, chunk, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (!nodehun || typeof nodehun.spellSuggestions !== 'function') {
        return callback(new TypeError(
            'First argument to nodehun-sentences must be an instance of nodehun'
        ));
    }

    var words = unique(chunk
        .toString()
        .split(/\s+/)
        .map(trimWord)
        .map(splitWord)
    ).filter(function(i) {
        return i && i.length > 1;
    });

    var wordCheck = partial(checkWord)(nodehun, opts);
    async.map(words, wordCheck, function(err, results) {
        if (err) {
            return callback(err);
        }

        callback(undefined, populatePositions(chunk, results));
    });
}

function populatePositions(text, words) {
    return words.filter(Boolean).map(function(entry) {
        return populatePosition(text, entry);
    });
}

function populatePosition(text, entry) {
    var matcher = new RegExp('(?:\\W|^)' + escapeRegExp(entry.word) + '(?:\\W|$)', 'g');
    var adjustment, match, wordLength = entry.word.length;

    entry.positions = [];
    while ((match = matcher.exec(text)) !== null) {
        adjustment = (match.index === 0 ? 0 : 1);

        entry.positions.push({
            from:   match.index + match[0].indexOf(entry.word),
            to:     match.index + wordLength + adjustment,
            length: wordLength
        });
    }

    return entry;
}

function checkWord(nodehun, opts, word, callback) {
    if (opts.cache) {
        var cached = opts.cache.get(word);
        if (cached && cached === true) {
            return setImmediate(callback, null);
        } else if (cached) {
            return setImmediate(callback, null, {
                word: word,
                suggestions: cached
            });
        }
    }

    nodehun.spellSuggestions(word, function(err, correct, suggestions) {
        if (err) {
            return callback(err);
        }

        if (opts.cache) {
            opts.cache.set(word, correct || suggestions);
        }

        if (correct) {
          return callback(null);
        }

        callback(undefined, {
            word: word,
            suggestions: suggestions
        });
    });
}

function trimWord(word) {
    var matches = word.match(/^[^\wÀ-ÿ]*([\wÀ-ÿ.]+)*[^\wÀ-ÿ]*$/i);
    word = (matches && matches[1]) || '';

    return word.replace(/^\d+$/, '');
}

function splitWord(word) {
    return word.replace(/\//g, ' ');
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}
