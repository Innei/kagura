import { Route, Router, Switch } from 'wouter';

import { ShellState } from '../features/review-panel/components/ShellState';
import { ReviewPage } from './ReviewPage';
import { getApiBasePath } from './routing';

const apiBasePath = getApiBasePath();

export function App() {
  return (
    <Router base={apiBasePath}>
      <Switch>
        <Route path="/reviews/:executionId">
          {(params) => (
            <ReviewPage
              apiBasePath={apiBasePath}
              executionId={decodeURIComponent(params.executionId)}
            />
          )}
        </Route>
        {import.meta.env.DEV && (
          <Route path="/">
            <ReviewPage apiBasePath={apiBasePath} executionId="mock-review" />
          </Route>
        )}
        <Route>
          <ShellState text="Review not found." />
        </Route>
      </Switch>
    </Router>
  );
}
