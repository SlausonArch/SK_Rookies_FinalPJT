import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import Matter from 'matter-js';
import { getUserAccessToken } from '../utils/auth';

const COLORS = {
    bg: '#093687',
    text: '#ffffff',
    primary: '#1a5bc4',
    accent: '#F0A202',
};

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  background: radial-gradient(circle at 50% 50%, #1a5bc4 0%, #093687 100%);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CanvasWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
`;

const TopActions = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 20;
  display: flex;
  gap: 10px;
  pointer-events: auto;
`;

const TopActionButton = styled.button`
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 10px;
  cursor: pointer;
  backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const Overlay = styled.div`
  position: relative;
  z-index: 10;
  text-align: center;
  pointer-events: none; /* Let clicks pass through to canvas for physics interaction, except on buttons */
`;

const Title = styled.h1`
  font-size: 3rem;
  font-weight: 900;
  color: ${COLORS.text};
  margin-bottom: 1rem;
  letter-spacing: -1px;
  text-shadow: 0 4px 12px rgba(0,0,0,0.3);
`;

const Subtitle = styled.p`
  font-size: 1.25rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 3rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  pointer-events: auto; /* Enable clicks on buttons */
`;

const ActionButton = styled.button<{ $variant?: 'bank' | 'crypto' }>`
  padding: 16px 36px;
  font-size: 1.1rem;
  font-weight: 800;
  border-radius: 14px;
  border: none;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  background: ${p => p.$variant === 'bank' ? '#ffffff' : 'rgba(255,255,255,0.1)'};
  color: ${p => p.$variant === 'bank' ? COLORS.primary : '#ffffff'};
  border: ${p => p.$variant === 'crypto' ? '1px solid rgba(255,255,255,0.3)' : 'none'};
  box-shadow: ${p => p.$variant === 'bank' ? '0 10px 25px rgba(0,0,0,0.2)' : 'none'};
  backdrop-filter: ${p => p.$variant === 'crypto' ? 'blur(10px)' : 'none'};

  &:hover {
    transform: translateY(-3px);
    box-shadow: ${p => p.$variant === 'bank' ? '0 15px 35px rgba(0,0,0,0.3)' : '0 10px 25px rgba(0,0,0,0.15)'};
    background: ${p => p.$variant === 'bank' ? '#f8f9fa' : 'rgba(255,255,255,0.2)'};
  }
`;

const Landing: React.FC = () => {
    const sceneRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const isLoggedIn = !!getUserAccessToken();

    useEffect(() => {
        if (!sceneRef.current) return;

        // Matter.js Module Aliases
        const Engine = Matter.Engine,
            Render = Matter.Render,
            Runner = Matter.Runner,
            MouseConstraint = Matter.MouseConstraint,
            Mouse = Matter.Mouse,
            Composite = Matter.Composite,
            Bodies = Matter.Bodies;

        // Create engine
        const engine = Engine.create();
        const world = engine.world;

        // Create renderer
        const width = window.innerWidth;
        const height = window.innerHeight;

        const render = Render.create({
            element: sceneRef.current,
            engine: engine,
            options: {
                width,
                height,
                background: 'transparent',
                wireframes: false,
            }
        });

        Render.run(render);

        // Create runner
        const runner = Runner.create();
        Runner.run(runner, engine);

        // Add boundaries
        const ground = Bodies.rectangle(width / 2, height + 30, width * 2, 60, { isStatic: true });
        const wallLeft = Bodies.rectangle(-30, height / 2, 60, height * 2, { isStatic: true });
        const wallRight = Bodies.rectangle(width + 30, height / 2, 60, height * 2, { isStatic: true });

        Composite.add(world, [ground, wallLeft, wallRight]);

        // Add continuous falling items (Coins and Banknotes)
        const createItem = (startX: number, startY: number) => {
            const isCoin = Math.random() > 0.5;
            if (isCoin) {
                const radius = 25 + Math.random() * 15;
                return Bodies.circle(startX, startY, radius, {
                    restitution: 0.8,
                    render: {
                        fillStyle: Math.random() > 0.5 ? '#F0A202' : '#FFD700',
                        strokeStyle: '#d98c00',
                        lineWidth: 3
                    }
                });
            } else {
                const bw = 80 + Math.random() * 40;
                const bh = 40 + Math.random() * 20;
                return Bodies.rectangle(startX, startY, bw, bh, {
                    restitution: 0.4,
                    frictionAir: 0.05,
                    render: {
                        fillStyle: '#2CB67D',
                        strokeStyle: '#1a8256',
                        lineWidth: 2
                    }
                });
            }
        };

        const initialItems: Matter.Body[] = [];
        for (let i = 0; i < 40; i++) {
            initialItems.push(createItem(Math.random() * width, Math.random() * -height));
        }
        Composite.add(world, initialItems);

        // Infinite stacking: continuously add bodies
        const spawnInterval = setInterval(() => {
            const currentBodies = Composite.allBodies(world).filter(b => !b.isStatic);
            // Limit body count to prevent browser crash from infinite physics processing
            if (currentBodies.length < 500) {
                const x = Math.random() * window.innerWidth;
                Composite.add(world, createItem(x, -50));
            }
        }, 400); // spawn every 400ms

        // Add mouse control
        const mouse = Mouse.create(render.canvas);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: false }
            }
        });

        Composite.add(world, mouseConstraint);
        render.mouse = mouse;

        // Handle resize
        const handleResize = () => {
            render.options.width = window.innerWidth;
            render.options.height = window.innerHeight;
            render.canvas.width = window.innerWidth;
            render.canvas.height = window.innerHeight;
            Matter.Body.setPosition(ground, { x: window.innerWidth / 2, y: window.innerHeight + 30 });
            Matter.Body.setPosition(wallRight, { x: window.innerWidth + 30, y: window.innerHeight / 2 });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            clearInterval(spawnInterval);
            window.removeEventListener('resize', handleResize);
            Render.stop(render);
            Runner.stop(runner);
            Engine.clear(engine);
            if (render.canvas && sceneRef.current) {
                sceneRef.current.removeChild(render.canvas);
            }
        };
    }, []);

    return (
        <Container>
            <CanvasWrapper ref={sceneRef} />
            {!isLoggedIn && (
                <TopActions>
                    <TopActionButton onClick={() => navigate(`/login?redirect=${encodeURIComponent('/')}`)}>로그인</TopActionButton>
                </TopActions>
            )}
            <Overlay>
                <Title>디지털 자산의 모든 것</Title>
                <Subtitle>은행 시스템과 가상 자산 거래소를 하나의 플랫폼에서 경험하세요.</Subtitle>
                <ButtonGroup>
                    <ActionButton $variant="bank" onClick={() => navigate('/bank')}>가상 은행 접속</ActionButton>
                    <ActionButton $variant="crypto" onClick={() => navigate('/crypto')}>암호화폐 거래소 접속</ActionButton>
                </ButtonGroup>
            </Overlay>
        </Container>
    );
};

export default Landing;
