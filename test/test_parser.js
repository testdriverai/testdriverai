const chai = require("chai");
const expect = chai.expect;
const { interpolate } = require("../agent/lib/parser");

describe("interpolate", function () {
  it("should replace variables in the string with values from the dictionary", function () {
    const template = "Hello, ${name}!";
    const vars = { name: "World" };
    const result = interpolate(template, vars);
    expect(result).to.equal("Hello, World!");
  });

  it("should replace multiple variables in the string", function () {
    const template = "Hi, ${firstName} ${lastName}!";
    const vars = { firstName: "Marcy", lastName: "the Dog" };
    const result = interpolate(template, vars);
    expect(result).to.equal("Hi, Marcy the Dog!");
  });

  it("should leave variables unchanged if they are not in the dictionary", function () {
    const template = "Hi, ${name} ${surname}!";
    const vars = { name: "John" };
    const result = interpolate(template, vars);
    expect(result).to.equal("Hi, John ${surname}!");
  });

  it("should return the original string if no variables are present", function () {
    const template = "Hello, World!";
    const vars = { name: "John" };
    const result = interpolate(template, vars);
    expect(result).to.equal("Hello, World!");
  });

  it("should handle an empty dictionary gracefully", function () {
    const template = "Hi, ${name}!";
    const vars = {};
    const result = interpolate(template, vars);
    expect(result).to.equal("Hi, ${name}!");
  });

  it("should not replace escaped variables", function () {
    const template = "Hello, \\${name}!";
    const vars = { name: "World" };
    const result = interpolate(template, vars);
    expect(result).to.equal("Hello, ${name}!");
  });
});
