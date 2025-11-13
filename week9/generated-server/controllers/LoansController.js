/**
 * The LoansController file is a very simple one, which does not need to be changed manually,
 * unless there's a case where business logic routes the request to an entity which is not
 * the service.
 * The heavy lifting of the Controller item is done in Request.js - that is where request
 * parameters are extracted and sent to the service, and where response is handled.
 */

const Controller = require('./Controller');
const service = require('../services/LoansService');
const borrowsGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.borrowsGET);
};

const loansGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.loansGET);
};

const loansLoanIdGET = async (request, response) => {
  await Controller.handleRequest(request, response, service.loansLoanIdGET);
};

const loansLoanIdReturnPUT = async (request, response) => {
  await Controller.handleRequest(request, response, service.loansLoanIdReturnPUT);
};

const loansPOST = async (request, response) => {
  await Controller.handleRequest(request, response, service.loansPOST);
};


module.exports = {
  borrowsGET,
  loansGET,
  loansLoanIdGET,
  loansLoanIdReturnPUT,
  loansPOST,
};
