/*global describe, it, before, beforeEach, after, afterEach, escape */
"use strict";

const chai = require('chai');
const expect = chai.expect;

const models = require('../index');
const Series = models.Series;
const Player = models.Player;
const Game = models.Game;


describe("CRUD", function () {
  let player1;
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

  it("should create player", function () {
    player1 = new Player("Foobar");
    return player1.save();
  });

  it("should add player to series", function () {
    return player1.addToSeries(series.name);
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
        game.unpopulate();
        expect(game.playersHome[0]).to.equal(player1.key());
        expect(game.series).to.equal(series.key());
      });
  });

});
