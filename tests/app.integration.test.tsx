// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../src/App';

const containers: HTMLElement[] = [];

const renderApp = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  await act(async () => { createRoot(container).render(<App />); });
  // initialize() 是异步的，再 flush 一次让示例文档载入完成
  await act(async () => { await Promise.resolve(); });
  return container;
};

afterEach(() => {
  containers.forEach((node) => node.remove());
  containers.length = 0;
});

describe('App zone integration', () => {
  it('renders zones and the check policy badge', async () => {
    const container = await renderApp();
    expect(container.textContent).toContain('展位片区');
    expect(container.textContent).toContain('活动片区');
    expect(container.textContent).toContain('餐饮片区');
    expect(container.textContent).toContain('隐藏的分区照常计入结论');
    // 未分区入口体现在分区汇总行
    expect(container.textContent).toContain('未分区');
  });

  it('temporarily hides a zone and clearly marks that it is still checked', async () => {
    const container = await renderApp();
    const hideDining = Array.from(container.querySelectorAll<HTMLButtonElement>('.zone-icon-button')).find((button) => button.getAttribute('aria-label') === '隐藏分区 餐饮片区');
    expect(hideDining).toBeTruthy();
    await act(async () => { hideDining!.click(); });
    expect(container.textContent).toContain('已隐藏 · 仍在检查范围内');
    expect(container.textContent).toMatch(/已隐藏 · 仍计入检查（\d+ 项问题）|已隐藏 · 仍计入检查（0 项问题）/);
    // 画布上提示隐藏数量
    expect(container.textContent).toContain('已临时隐藏 1 个分区（仍计入检查）');
  });

  it('deletes a zone but keeps its elements and returns them to unzoned', async () => {
    const container = await renderApp();
    const deleteDining = Array.from(container.querySelectorAll<HTMLButtonElement>('.zone-icon-button.danger')).find((button) => button.getAttribute('aria-label') === '删除分区 餐饮片区（元素保留）');
    expect(deleteDining).toBeTruthy();
    await act(async () => { deleteDining!.click(); });
    // 分区行与删除按钮都已消失（顶部统计剩 2 个分区）
    expect(container.querySelector('button[aria-label="删除分区 餐饮片区（元素保留）"]')).toBeNull();
    expect(container.textContent).toMatch(/2分区/);
    expect(container.querySelectorAll('.breakdown-row')).toHaveLength(3); // 展位、活动、未分区（餐饮行消失）
    expect(container.querySelector('.breakdown-name')?.textContent).not.toContain('餐饮片区');
    // 原成员元素仍渲染、可选
    expect(container.textContent).toContain('休息座席');
    expect(container.textContent).toContain('轻食摊位');
    expect(container.textContent).toContain('2 个元素回到未分区状态，未被删除');
    // 回到未分区后，未分区行的元素计数变为 3
    const unzonedRow = Array.from(container.querySelectorAll('.breakdown-row')).find((row) => row.textContent?.includes('未分区'));
    expect(unzonedRow?.textContent).toContain('3 个元素');
  });

  it('locks a zone: its canvas element shows a lock badge and the inspector warns', async () => {
    const container = await renderApp();
    const lockActivity = container.querySelector('button[aria-label="锁定分区 活动片区"]') as HTMLButtonElement;
    expect(lockActivity).toBeTruthy();
    await act(async () => { lockActivity.click(); });
    expect(document.querySelector('.canvas-element.is-locked-element .lock-badge')).toBeTruthy();
    const stageButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.canvas-element')).find((button) => button.textContent?.includes('分享舞台'));
    await act(async () => { stageButton!.click(); });
    expect(document.querySelector('.inspector-panel')?.textContent).toContain('已锁定分区');
  });
});
