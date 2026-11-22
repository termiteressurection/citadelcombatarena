import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { StoryAndProtocolModalContent } from '../HUD';
import { REGIONAL_STORIES, createInitialStoryProgress } from '../rpg/stories';
import { useGame } from '../store';

const initialState = useGame.getState();
const renderModal = () => renderToStaticMarkup(createElement(StoryAndProtocolModalContent, { game: useGame.getState() }));

afterEach(() => {
  useGame.setState(initialState, true);
});

describe('story and protocol interactions', () => {
  it('shows each story choice and closes after a selection', () => {
    const story = REGIONAL_STORIES[0];
    useGame.setState({
      scene: 'ludus',
      activeStoryId: story.id,
      activeSpecialModal: null,
      storyProgress: createInitialStoryProgress(),
    });
    const html = renderModal();
    expect(html).toContain(story.stages[0].promptTitle);
    for (const choice of story.stages[0].choices) {
      expect(html).toContain(choice.label);
    }
    expect(useGame.getState().chooseStoryOption(story.id, story.stages[0].choices[0].verb)).not.toBeNull();
    expect(useGame.getState().activeStoryId).toBeNull();
    expect(useGame.getState().storyProgress[story.id].stageIndex).toBe(1);
  });

  it('keeps the final choice hidden in the arena and shows it on return', () => {
    useGame.setState({ scene: 'arena', activeStoryId: null, activeSpecialModal: 'restore_choice' });
    expect(renderModal()).toBe('');
    useGame.getState().setScene('ludus');
    const html = renderModal();
    expect(html).toContain('RESTORE THE GHOST-VILLAGES');
    expect(html).toContain('CLAIM SOVEREIGN ROOT');
    useGame.getState().completeRestoreProtocol('restored');
    expect(useGame.getState().restoreProtocolState).toBe('restored');
    expect(useGame.getState().activeSpecialModal).toBeNull();
  });

  it('offers an escape if a story is unavailable', () => {
    useGame.setState({ scene: 'ludus', activeStoryId: 'missing', activeSpecialModal: null });
    const html = renderModal();
    expect(html).toContain('STORY UNAVAILABLE');
    expect(html).toContain('CLOSE');
  });
});
