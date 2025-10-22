<script>
  export let question = "Question?";
  export let options = [];
  export let answer = "";
  
  let selected = null;
  let isCorrect = null;
  let showAnswer = false;

  function selectOption(option) {
    selected = option;
    isCorrect = option === answer;
    showAnswer = true;
  }
</script>

<div class="quiz-container">
  <div class="question-header">
    <h3 class="question-text">{question}</h3>
  </div>

  <div class="options-container">
    {#each options as opt, index}
      <button
        on:click={() => selectOption(opt)}
        disabled={showAnswer}
        class="option-button {selected === opt ? (isCorrect ? 'correct' : 'incorrect') : ''} {showAnswer && opt === answer ? 'highlight-correct' : ''}"
      >
        <span class="option-letter">{String.fromCharCode(65 + index)}</span>
        <span class="option-text">{opt}</span>
        {#if showAnswer && opt === answer}
          <span class="correct-icon">✓</span>
        {/if}
        {#if selected === opt && !isCorrect}
          <span class="incorrect-icon">✗</span>
        {/if}
      </button>
    {/each}
  </div>

  {#if showAnswer}
    <div class="result-container {isCorrect ? 'correct-result' : 'incorrect-result'}">
      {#if isCorrect}
        <div class="result-content">
          <span class="result-emoji">🎉</span>
          <span class="result-text">Excellent! You got it right!</span>
        </div>
      {:else}
        <div class="result-content">
          <span class="result-emoji">💡</span>
          <span class="result-text">The correct answer is: <strong>{answer}</strong></span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .quiz-container {
    margin: 2rem 0;
    padding: 1.5rem;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  }

  .quiz-container:hover {
    box-shadow: 0 8px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .question-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e2e8f0;
  }

  .question-text {
    font-size: 1.2rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
    line-height: 1.4;
  }

  .options-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .option-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border: 2px solid #cbd5e1;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    font-size: 1rem;
    min-height: 60px;
  }

  .option-button:hover:not(:disabled) {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px -2px rgba(59, 130, 246, 0.2);
  }

  .option-button:disabled {
    cursor: not-allowed;
  }

  .option-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #e2e8f0;
    border-radius: 50%;
    font-weight: 700;
    color: #475569;
    flex-shrink: 0;
  }

  .option-text {
    flex: 1;
    color: #374151;
    font-weight: 500;
  }

  .correct-icon, .incorrect-icon {
    font-size: 1.2rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  .correct-icon {
    color: #16a34a;
  }

  .incorrect-icon {
    color: #dc2626;
  }

  .option-button.correct {
    border-color: #16a34a;
    background: #dcfce7;
  }

  .option-button.correct .option-letter {
    background: #16a34a;
    color: white;
  }

  .option-button.incorrect {
    border-color: #dc2626;
    background: #fef2f2;
  }

  .option-button.incorrect .option-letter {
    background: #dc2626;
    color: white;
  }

  .option-button.highlight-correct {
    border-color: #16a34a;
    background: #dcfce7;
    animation: pulse-correct 0.6s ease-in-out;
  }

  .option-button.highlight-correct .option-letter {
    background: #16a34a;
    color: white;
  }

  @keyframes pulse-correct {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .result-container {
    padding: 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: slideIn 0.3s ease-out;
  }

  .correct-result {
    background: #dcfce7;
    border: 2px solid #16a34a;
  }

  .incorrect-result {
    background: #fef2f2;
    border: 2px solid #dc2626;
  }

  .result-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .result-emoji {
    font-size: 1.5rem;
  }

  .result-text {
    font-weight: 600;
    color: #374151;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 640px) {
    .quiz-container {
      margin: 1rem 0;
      padding: 1rem;
    }
    
    .question-text {
      font-size: 1.1rem;
    }
    
    .option-button {
      padding: 0.75rem;
      min-height: 50px;
    }
    
    .result-container {
      flex-direction: column;
      gap: 1rem;
      align-items: stretch;
    }
  }
</style>
