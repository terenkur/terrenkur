async function getFetch() {
  if (typeof global.fetch === 'function') {
    return global.fetch;
  }

  const { default: nodeFetch } = await import('node-fetch');
  global.fetch = nodeFetch;
  return nodeFetch;
}

module.exports = {
  getFetch,
};
