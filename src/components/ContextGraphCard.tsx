import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useContextGraph } from '../hooks/useContextGraph';

interface Props {
  contextId: string | null;
  contextType: 'goal' | 'task' | 'session' | null;
  width?: number;
  height?: number;
}

export default function ContextGraphCard({ contextId, contextType, width = 340, height = 320 }: Props) {
  const fgRef = useRef<any>(null);
  const [hoverNode, setHoverNode] = useState<any>(null);

  const { nodes, links, adjacency, centerNodeId } = useContextGraph(contextId, contextType);

  const graphData = useMemo(() => {
    // Clone nodes arrays to avoid mutating the original hook output on physics sim
    const newNodes = nodes.map(n => ({
      ...n,
      fx: n.id === centerNodeId ? 0 : undefined,
      fy: n.id === centerNodeId ? 0 : undefined,
    }));
    return { nodes: newNodes, links: links.map(l => ({ ...l })) };
  }, [nodes, links, centerNodeId]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Re-heat simulation
      fgRef.current.d3Force('charge')?.strength((node: any) => {
        if (node.type === 'goal') return -200;
        if (node.type === 'task') return -80;
        return -30;
      });
      fgRef.current.d3Force('link')?.distance((link: any) => {
        if (link.source.type === 'goal' || link.target.type === 'goal') return 80;
        return 50;
      });

      fgRef.current.d3ReheatSimulation();
      
      // Center
      setTimeout(() => {
        fgRef.current?.zoomToFit(400);
      }, 50);
    }
  }, [contextId, graphData.nodes.length]);

  const isConnected = useCallback((a: string, b: string) => {
    return adjacency.get(a)?.includes(b);
  }, [adjacency]);

  if (!contextId || graphData.nodes.length === 0) {
    return (
      <div className="ifz14-section-card" style={{ height: `${height}px`, width: `${width}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em' }}>Hover a goal to see its structure</div>
      </div>
    );
  }

  return (
    <div className="ifz14-section-card" style={{ height: `${height}px`, width: `${width}px`, overflow: 'hidden', position: 'relative', padding: 0 }}>
      {/* Decorative gradient drop in the background */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at center, rgba(255,255,255,0.02), transparent 70%)' }} />
      
      <div style={{ position: 'absolute', top: '16px', left: '20px', zIndex: 10 }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#8a8a8a' }}>CONTEXT GRAPH</div>
        <div style={{ fontSize: '12px', color: '#fff', fontWeight: 500, marginTop: '2px', textTransform: 'capitalize' }}>
           {contextType} Focused
        </div>
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        cooldownTicks={50}
        d3VelocityDecay={0.4}
        enableNodeDrag={false}
        enableZoomInteraction={false}
        enablePanInteraction={false}
        nodeRelSize={1}
        width={width}
        height={height}
        linkColor={(link: any) => {
          if (!hoverNode) return 'rgba(255,255,255,0.05)';
          const isLinkHovered = (link.source.id === hoverNode.id || link.target.id === hoverNode.id);
          return isLinkHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.0)';
        }}
        linkWidth={(link: any) => {
          if (!hoverNode) return 1;
          const isLinkHovered = (link.source.id === hoverNode.id || link.target.id === hoverNode.id);
          return isLinkHovered ? 2 : 0;
        }}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const isHovered = hoverNode && hoverNode.id === node.id;
          const isNeighbor = hoverNode && isConnected(hoverNode.id, node.id);
          const opacity = !hoverNode ? (node.completed ? 0.9 : 0.6) : (isHovered || isNeighbor ? 1 : 0.1);

          const size = node.val;
          let color = node.type === 'goal' ? '#4da6ff' : node.type === 'task' ? '#00ff88' : '#aaaaaa';
          
          if (node.type === 'goal' && node.pressure && node.pressure >= 6) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(255, 77, 77, ${opacity})`;
            color = '#ff4d4d'; // Red intense goal
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.globalAlpha = opacity;
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0; // reset

          // Label
          if (node.type === 'goal' || isHovered) {
             const label = node.label;
             const fontSize = node.type === 'goal' ? 12/globalScale : 10/globalScale;
             ctx.font = `${fontSize}px "Inter", sans-serif`;
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillStyle = `rgba(255,255,255,${opacity})`;
             ctx.fillText(label, node.x, node.y + size + (6/globalScale));
          }
        }}
        onNodeHover={(node) => setHoverNode(node)}
      />
    </div>
  );
}
