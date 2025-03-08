
import type { Meta, StoryObj } from '@storybook/web-components';

import type { FeaturesCollectionProps } from './FeaturesCollection';
import { FeaturesCollection } from './FeaturesCollection';

import { Bandpowers } from './Bandpowers';
import { ScoreComponent } from './Score';
import { Score } from 'neurosys'

// Score stuff
const SCALE = 1000
const randomValues = Array.from({ length: 10 }, () => SCALE*Math.random());
const min = Math.min(...randomValues);
const max = Math.max(...randomValues);
const other = randomValues.find(v => v !== min && v !== max);
const range = max - min;



// More on how to set up stories at: https://storybook.js.org/docs/writing-stories
const meta = {
  title: 'Plugins/Inspect',
  tags: [ 'plugin', 'output', 'inspect' ],
  render: ({ bands, score }) => {
    const bandsComponent = new Bandpowers({ data: bands });
    const scoreComponent = new ScoreComponent(score);
    
    // Animate the score
    if (score) {
        
        let keepAnimating = true
        const animate = setInterval(() => {

            if (!keepAnimating) return clearInterval(animate)

            const { info } = scoreComponent
            const raw = info.raw

            // random walk the score proportionally to the range
            const step = range * 0.01 * Math.random()
            const newValue = raw + step
            info.update(newValue)
            scoreComponent.requestUpdate()
        }, 100)

        document.onkeydown = (e) => {
            const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (dir) {
                keepAnimating = false
                const { info } = scoreComponent
                const raw = info.raw
                const step = range * 0.01 * dir
                const newValue = raw + step
                info.update(newValue)
                scoreComponent.requestUpdate()
            }
        }

    }

    else document.onkeydown = null
        

    return new FeaturesCollection([scoreComponent, bandsComponent]);
  }
} satisfies Meta<FeaturesCollectionProps>;

export default meta;
type Story = StoryObj<FeaturesCollectionProps>;



export const ScoreDisplay: Story = {
    args: {
        score: {
            info: new Score({ raw: other, min, max, target: false })
        }
    },
};

export const ScoreDisplayWithTarget: Story = {
    args: {
        score: {
            info: new Score({ 
                raw: other, 
                min, 
                max,
                target: [ min + range * 0.7, min + range * 0.9 ]
            })
        }
    },
};

const total = 1250

export const BandpowersDisplay: Story = {
    args: {  
        bands: {
            Fp1: { 
                'delta': { value: 0.2 * total, total }, 
                'theta': { value: 0.2 * total, total }, 
                'alpha': { value: 0.3 * total, total }, 
                'beta': { value: 0.1 * total, total }, 
                'gamma': { value: 0.1 * total, total }
            },
            Fp2: {
                'alpha': { value: 0.3 * total, total },
                'beta': { value: 0.5 * total, total }
            },
            AUX: { 
                delta: { value: 0.1 * total, total },
                theta: { value: 0.2 * total, total },
             }
        }
    },
};

export const AllFeatures: Story = {
    args: {
      ...BandpowersDisplay.args,
      ...ScoreDisplayWithTarget.args
    },
  };
  

export const Empty: Story = {
  args: {},
};