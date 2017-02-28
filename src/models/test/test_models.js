"use strict";

const chai = require('chai');
const expect = chai.expect;

const models = require('../index');
const Series = models.Series;
const Player = models.Player;
const Game = models.Game;

const series = new Series("ööl");
const player = new Player("Junno");
const game = new Game({
  series: series,
  teamAway: "MTL",
  teamHome: "CBJ",
  goalsAway: 1,
  goalsHome: 2,
  playersHome: [player],
  playersAway: [],
});

game.unpopulate();
game.populate()
  .then(function () {
    expect(game.playersHome[0].name).to.equal(player.name);
    expect(game.series.name).to.equal(series.name);
    game.unpopulate();
    expect(game.playersHome[0]).to.equal(player.key());
    expect(game.series).to.equal(series.key());
  })
  .catch(function (err) {
    console.log("Error in test", err);
  });
