/* eslint-env jest */
module.exports = {
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
};
