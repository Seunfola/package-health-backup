module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.{t,j}s'],
  coverageDirectory: '../coverage',

  // Tell Jest to transform modern JS packages in node_modules
  transformIgnorePatterns: [
    "node_modules/(?!(yargs|yargs/helpers)/)"
  ],

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
  },
};