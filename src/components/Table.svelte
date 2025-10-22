<script lang="ts">
  export let columns: string[] = [];
  export let rows: string[][] = [];
  export let striped: boolean = false;
  export let compact: boolean = false;
</script>

<div class="table-container">
  <table class="custom-table">
    <thead class="table-header">
      <tr>
        {#each columns as col}
          <th 
            class="table-header-cell"
            class:compact={compact}
          >
            {col}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="table-body">
      {#each rows as row, index}
        <tr 
          class="table-row"
          class:striped-row={striped && index % 2 === 1}
          class:compact={compact}
        >
          {#each row as cell}
            <td 
              class="table-cell"
              class:compact={compact}
            >
              {cell}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-container {
    overflow-x: auto;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    background-color: white;
    margin: 1rem 0;
  }
  
  .custom-table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  
  .table-header {
    background-color: #f9fafb;
  }
  
  .table-header-cell {
    padding: 1rem 1.5rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: #374151;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: #f9fafb;
  }
  
  .table-header-cell.compact {
    padding: 0.5rem 0.75rem;
  }
  
  .table-header-cell:first-child {
    border-top-left-radius: 0.5rem;
  }
  
  .table-header-cell:last-child {
    border-top-right-radius: 0.5rem;
  }
  
  .table-body {
    background-color: white;
  }
  
  .table-row {
    transition: background-color 0.15s ease-in-out;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .table-row:hover {
    background-color: #f9fafb !important;
    cursor: default;
  }
  
  .table-row.striped-row {
    background-color: #f8fafc;
  }
  
  .table-cell {
    padding: 1rem 1.5rem;
    font-size: 0.875rem;
    color: #111827;
    white-space: nowrap;
  }
  
  .table-cell.compact {
    padding: 0.5rem 0.75rem;
  }
  
  @media (max-width: 640px) {
    .table-header-cell,
    .table-cell {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .table-header-cell.compact,
    .table-cell.compact {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
  }
  
  @media (prefers-color-scheme: dark) {
    .table-container {
      background-color: #1f2937;
      border-color: #374151;
    }
    
    .custom-table {
      background-color: #1f2937;
    }
    
    .table-header {
      background-color: #1f2937;
    }
    
    .table-header-cell {
      background-color: #1f2937;
      color: #d1d5db;
      border-color: #374151;
    }
    
    .table-body {
      background-color: #1f2937;
    }
    
    .table-row {
      border-color: #374151;
    }
    
    .table-row:hover {
      background-color: #374151 !important;
    }
    
    .table-row.striped-row {
      background-color: #2d3748;
    }
    
    .table-cell {
      color: #f3f4f6;
    }
  }
</style>
