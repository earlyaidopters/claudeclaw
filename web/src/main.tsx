import { render } from 'preact';
import { App } from './App';
import './styles/main.css';
import './lib/theme';       // initializes the theme effect on import
import './lib/api';         // initializes the dashboard token cache from URL
import { startChatStream } from './lib/chat-stream';

// Single chat SSE for the lifetime of the page. Any view subscribes and
// the sidebar reads the unread count from the same signal.
startChatStream();

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
}
