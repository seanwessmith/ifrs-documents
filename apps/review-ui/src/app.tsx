import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

interface Unit {
  id: string;
  type: 'function' | 'claim' | 'definition';
  data: any;
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
}

function ReviewApp() {
  const [documents, setDocuments] = useState<Array<{id: string, title: string}>>([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [unitType, setUnitType] = useState('all');
  const [status, setStatus] = useState('pending');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  // Mock data for now - in real implementation this would fetch from API
  useEffect(() => {
    setDocuments([
      { id: 'doc-1', title: 'Machine Learning Handbook' },
      { id: 'doc-2', title: 'Statistics Textbook' },
      { id: 'doc-3', title: 'Data Science Guide' }
    ]);
  }, []);

  const loadUnits = async () => {
    if (!selectedDoc) return;
    
    setLoading(true);
    
    // Mock API call - replace with actual API
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUnits: Unit[] = [
      {
        id: '1',
        type: 'function',
        data: {
          name: 'calculateMean',
          purpose: 'Calculate the arithmetic mean of a dataset',
          inputs: [{ name: 'data', type: 'number[]', required: true }],
          steps: [
            { n: 1, text: 'Sum all values in the dataset' },
            { n: 2, text: 'Divide by the count of values' }
          ],
          outputs: [{ name: 'mean', type: 'number' }]
        },
        confidence: 0.92,
        status: 'pending'
      },
      {
        id: '2',
        type: 'claim',
        data: {
          subject: 'Central Limit Theorem',
          predicate: 'states that',
          object: 'sample means approach normal distribution'
        },
        confidence: 0.85,
        status: 'pending'
      },
      {
        id: '3',
        type: 'definition',
        data: {
          term: 'Standard Deviation',
          definition: 'A measure of the amount of variation in a dataset',
          aliases: ['stddev', 'σ']
        },
        confidence: 0.88,
        status: 'pending'
      }
    ];
    
    setUnits(mockUnits);
    setLoading(false);
  };

  const handleAction = (unitId: string, action: 'approve' | 'reject' | 'edit') => {
    setUnits(prev => prev.map(unit => 
      unit.id === unitId 
        ? { ...unit, status: action === 'edit' ? unit.status : action === 'approve' ? 'approved' : 'rejected' }
        : unit
    ));
    
    if (action === 'edit') {
      console.log('Edit functionality would open a modal here');
    }
  };

  const renderUnit = (unit: Unit) => {
    const confidenceClass = unit.confidence > 0.8 ? 'high' : unit.confidence > 0.6 ? 'medium' : 'low';
    
    return (
      <div key={unit.id} className="unit-card">
        <div className="unit-type">{unit.type}</div>
        
        {unit.type === 'function' && (
          <>
            <div className="unit-title">{unit.data.name}</div>
            <div className="unit-content">
              <strong>Purpose:</strong> {unit.data.purpose}<br/>
              {unit.data.inputs?.length > 0 && (
                <>
                  <strong>Inputs:</strong> {unit.data.inputs.map((inp: any) => `${inp.name}:${inp.type}`).join(', ')}<br/>
                </>
              )}
              {unit.data.steps?.length > 0 && (
                <>
                  <strong>Steps:</strong>
                  <ol>
                    {unit.data.steps.slice(0, 3).map((step: any) => (
                      <li key={step.n}>{step.text}</li>
                    ))}
                    {unit.data.steps.length > 3 && <li>... {unit.data.steps.length - 3} more steps</li>}
                  </ol>
                </>
              )}
            </div>
          </>
        )}
        
        {unit.type === 'claim' && (
          <>
            <div className="unit-title">Claim</div>
            <div className="unit-content">
              <strong>{unit.data.subject}</strong> {unit.data.predicate} <strong>{unit.data.object}</strong>
            </div>
          </>
        )}
        
        {unit.type === 'definition' && (
          <>
            <div className="unit-title">{unit.data.term}</div>
            <div className="unit-content">
              {unit.data.definition}
              {unit.data.aliases?.length > 0 && (
                <><br/><strong>Aliases:</strong> {unit.data.aliases.join(', ')}</>
              )}
            </div>
          </>
        )}
        
        <div>
          <span className={`confidence ${confidenceClass}`}>
            {Math.round(unit.confidence * 100)}% confidence
          </span>
        </div>
        
        <div className="actions">
          <button 
            className="btn btn-approve" 
            onClick={() => handleAction(unit.id, 'approve')}
            disabled={unit.status === 'approved'}
          >
            ✓ Approve
          </button>
          <button 
            className="btn btn-reject" 
            onClick={() => handleAction(unit.id, 'reject')}
            disabled={unit.status === 'rejected'}
          >
            ✗ Reject
          </button>
          <button 
            className="btn btn-edit" 
            onClick={() => handleAction(unit.id, 'edit')}
          >
            ✏️ Edit
          </button>
        </div>
      </div>
    );
  };

  const filteredUnits = units.filter(unit => {
    if (unitType !== 'all' && unit.type !== unitType) return false;
    if (unit.status !== status) return false;
    return true;
  });

  return (
    <>
      <div className="filter-bar">
        <label>Document:</label>
        <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)}>
          <option value="">Select a document...</option>
          {documents.map(doc => (
            <option key={doc.id} value={doc.id}>{doc.title}</option>
          ))}
        </select>
        
        <label>Unit Type:</label>
        <select value={unitType} onChange={e => setUnitType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="function">Functions</option>
          <option value="claim">Claims</option>
          <option value="definition">Definitions</option>
        </select>
        
        <label>Status:</label>
        <select value={status} onChange={e => setStatus(e.target.value as any)}>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        
        <button className="btn btn-approve" onClick={loadUnits} disabled={loading || !selectedDoc}>
          {loading ? 'Loading...' : 'Load Units'}
        </button>
      </div>
      
      <div className="content">
        <div id="unitsContainer">
          {loading ? (
            <div className="loading">Loading units...</div>
          ) : filteredUnits.length === 0 ? (
            <div className="loading">No units found matching filters.</div>
          ) : (
            filteredUnits.map(renderUnit)
          )}
        </div>
      </div>
    </>
  );
}

// Mount the app
const container = document.querySelector('.container');
if (container) {
  // Replace the existing content with our React app
  container.innerHTML = `
    <div class="header">
      <h1>IFRS Review Interface</h1>
      <p>Review and validate extracted units</p>
    </div>
    <div id="react-root"></div>
  `;
  
  const root = createRoot(document.getElementById('react-root')!);
  root.render(<ReviewApp />);
}