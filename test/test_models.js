/*global describe, it, before, beforeEach, after, afterEach, escape */
"use strict";

const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;

const models = require('../src/lib/models');
const Series = models.Series;
const Player = models.Player;
const Game = models.Game;


describe("CRUD", function () {
  this.timeout(10000);
  let player1;
  let player2;
  let series;
  let game;

  it("should create series", function () {
    series = new Series("bar");
    return series.save();
  });

  it("should list series", function () {
    return Series.list()
      .then(function (keys) {
        expect(keys).to.contain("bar");
      });
  });

  it("should create players", function () {
    player1 = new Player("Foobar");
    player2 = new Player("Ööliä");
    return Promise.all([player1.save(), player2.save()]);
  });

  it("should add player to series", function () {
    return Promise.all([player1.addToSeries(series.name), player2.addToSeries(series.name)])
      .then(function () {
        // refresh the series to see that player was added
        return series.load(series.key());
      })
      .then(function () {
        expect(series.players.length).to.equal(2);
        expect(series.players).to.contain(player1.key());
        expect(series.players).to.contain(player2.key());
        return series.populate();
      });
  });

  it("should serialize series", () => {
    const serialized = series.serialize();
    let p = _.find(serialized.players, _.matchesProperty('username', 'foobar'));
    expect(p).to.be.ok;
    expect(p.stats.numberOfGames).to.equal(3);
    p = _.find(serialized.players, _.matchesProperty('username', 'ööliä'));
    expect(p).to.be.ok;
    expect(p.stats.numberOfGames).to.equal(3);
  });

  it("should create game", function () {
    game = new Game({
      series: series.key(),
      teamAway: "MTL",
      teamHome: "CBJ",
      goalsAway: 1,
      goalsHome: 2,
      playersHome: [player1.key()],
      playersAway: [],
    });
    return game.save();
  });

  it("should populate and unpopulate game", function () {
    game.unpopulate();
    return game.populate()
      .then(function () {
        expect(game.playersHome[0].name).to.equal(player1.name);
        expect(game.series.name).to.equal(series.name);
      });
  });

  it("should load game", function () {
    const loaded = new Game();
    return loaded.load(game.key())
      .then(function () {
        return loaded.populate();
      })
      .then(function () {
        expect(game.playersHome[0].name).to.equal(loaded.playersHome[0].name);
        expect(game.uuid).to.equal(loaded.uuid);
      });
  });

});
