import React, { useState, useEffect } from 'react';

interface ProgressEvent {
  eventType: string;
  sectionId: string;
  percent: number;
  timestamp: number;
  description?: string;
}

export function ResearchGraph() {
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/deep-research/progress');
    eventSource.onmessage = (e) => {
      try {
        const data: ProgressEvent = JSON.parse(e.data);
        setEvents(prev => [...prev, data]);
      } catch (err) {
        console.error('Failed to parse progress event:', err);
      }
    };
    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      eventSource.close();
    };
    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Research Process Graph</h2>
      <svg width="800" height="400">
        {/* Start Node */}
        <circle cx="50" cy="200" r="20" fill="#4caf50" />
        <text x="30" y="205" fill="#fff" fontSize="10">Start</text>
        {/* Render progress events as nodes */}
        {events.map((evt, index) => (
          <g key={index} transform={`translate(${150 + index * 150}, 200)`}>
            <circle cx="0" cy="0" r="20" fill="#2196f3" >
              <title>{`Event Type: ${evt.eventType}
Section: ${evt.sectionId}
Progress: ${evt.percent}%
Time: ${new Date(evt.timestamp).toLocaleTimeString()}
Desc: ${evt.description || ''}`}</title>
            </circle>
            <text x="-20" y="5" fill="#fff" fontSize="10">{evt.sectionId}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}