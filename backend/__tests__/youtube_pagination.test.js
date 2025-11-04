const { getPlaylists } = require('../youtube');

describe('YouTube pagination', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete global.fetch;
  });

  it('fetches all pages until there is no nextPageToken', async () => {
    const firstPage = {
      items: [
        {
          id: { videoId: 'new-video' },
          snippet: {
            title: 'New Video',
            description: '#hashtag Latest adventures',
            publishedAt: '2024-01-01T00:00:00Z',
            thumbnails: { medium: { url: 'thumb-new' } },
          },
        },
      ],
      nextPageToken: 'TOKEN',
    };

    const secondPage = {
      items: [
        {
          id: { videoId: 'old-video' },
          snippet: {
            title: 'Old Video',
            description: '#hashtag Classic content',
            publishedAt: '2020-01-01T00:00:00Z',
            thumbnails: { medium: { url: 'thumb-old' } },
          },
        },
      ],
    };

    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => firstPage })
      .mockResolvedValueOnce({ ok: true, json: async () => secondPage });

    const playlists = await getPlaylists('api', 'channel', 'hashtag');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[0][0]).not.toContain('pageToken=');
    expect(global.fetch.mock.calls[1][0]).toContain('pageToken=TOKEN');

    expect(playlists.hashtag).toEqual([
      {
        id: 'new-video',
        title: 'New Video',
        description: '#hashtag Latest adventures',
        publishedAt: '2024-01-01T00:00:00Z',
        thumbnail: 'thumb-new',
      },
      {
        id: 'old-video',
        title: 'Old Video',
        description: '#hashtag Classic content',
        publishedAt: '2020-01-01T00:00:00Z',
        thumbnail: 'thumb-old',
      },
    ]);
  });
});
