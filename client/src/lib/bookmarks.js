import api from './api';

export const fetchMyBookmarks = () =>
  api.get('/bookmarks/me').then((res) => res.data);

export const addBookmark = (articleId) =>
  api.post('/bookmarks', { article_id: articleId });

export const removeBookmark = (articleId) =>
  api.delete(`/bookmarks/${articleId}`);
