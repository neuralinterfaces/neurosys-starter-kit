import { LitElement, html, css } from 'lit';
import { Score } from 'neurosys'

export type ScoreProps = {
    info?: Score
}

export class ScoreComponent extends LitElement {
  static styles = css`

    :host > div {
        box-sizing: border-box;
        font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        display: flex;
        flex-direction: column;
        color: white;
        background: #111;
        width: min-content;
        border-radius: 5px;
        width: 100%;
        padding: 15px;
        gap: 10px;
    }

    #visuals {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
    }

    #text {
        display: flex;
        gap: 15px;
        align-items: end;
    }

    .range {
        font-size: 12px;
    }
        

    #bar {
        position: relative;
        height: 12px;
        background: #333;
        overflow: hidden;
        flex-grow: 1;
    }

    #indicator {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: white;
        height: 100%;
        transform: translateX(-50%);
        z-index: 1;
    }

    #target {
        position: absolute;
        top: 0;
        bottom: 0;
        background:rgb(162, 162, 162);
        opacity: .6;
    }

    [in-range] #target {
        background: rgb(92, 222, 96);
    }

  `;

  declare info: ScoreProps['info'];

  static properties = {
    info: { type: Object },
  } as const;


  constructor({ info }: ScoreProps = {}) {
    super();
    this.info = info;
  }

  render() {
    const { info } = this;

    if (!info) return ""

    const { raw, min, max } = info;
    const target = info.getTarget();
    const isInTarget = info.inTarget()
    const normed = info.normalize(raw, false)
    const indicatorPosition = info.normalize(raw, false)

    const range = max - min
    const normedTarget = target && target.map(t => (t - min) / range) // Normalize target
    const [ targetMin, targetMax ] = normedTarget

    return html`
        <div>
            <div id="visuals">
                <span class="range">${min.toFixed(2)}</span>
                <div id="bar" ?in-range=${isInTarget}>
                    <div id="indicator" style="left: ${indicatorPosition * 100}%"></div>
                    <div id="target" style="left: ${targetMin*100}%; right: ${(1 - targetMax)*100}%"></div>
                </div>
                <span class="range">${max.toFixed(2)}</span>
            </div>
            <div id="text">
                <small>
                    <b>Raw</b>
                    <span>${raw.toFixed(2)}
                    </span>
                </small>
                <small>
                    <b>Normalized</b>
                    <span>${normed.toFixed(2)}</span>
                </small>
            </div>
        </div>
    `;
  }
}

customElements.define('score-component', ScoreComponent);
