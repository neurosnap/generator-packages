import createAction from './action';
import createReducer from './reducer';
import { Action } from './types';

type ActionCreator = (payload?: any) => Action<any>;
interface ActionMap {
  [key: string]: ActionCreator;
}
type Reduce<State> = (state: State, payload?: any) => State;
interface ReduceMap<State> {
  [key: string]: Reduce<State>;
}
interface ICreate<State> {
  slice: string;
  actions: { [key: string]: Reduce<State> };
  initialState: State;
}

const getType = (slice: string, action: string) =>
  slice ? `${slice}/${action}` : action;

export default function create<State>({
  slice = '',
  actions = {},
  initialState,
}: ICreate<State>) {
  const actionKeys = Object.keys(actions);

  const reducerMap: ReduceMap<State> = actionKeys.reduce(
    (map: ReduceMap<State>, action: string) => {
      map[getType(slice, action)] = actions[action];
      return map;
    },
    {},
  );

  const reducer = createReducer(initialState, reducerMap);

  const actionMap: ActionMap = actionKeys.reduce(
    (map: ActionMap, action: string) => {
      const type = getType(slice, action);
      map[action] = createAction(type);
      return map;
    },
    {},
  );

  return {
    actions: actionMap,
    reducer,
    slice,
  };
}
