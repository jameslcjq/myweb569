// ==UserScript==
// @name         自动录入
// @namespace    https://www.hujiuxi.top/
// @version      5.13.0 (Toolbar Embed)
// @description  将按钮嵌入到工具栏“更多”之后。解决按钮遮挡问题，由 Gemini 生成。
// @author       老九
// @match        http://10.65.248.23/framework-web2/businessHome_JS/businessHome_JS.html
// @match        *://*/pay-voucher-server/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 工具栏嵌入版 v5.13.0 已启动');

    // =================================================================
    // ⚙️ 用户配置
    // =================================================================
    const Config = {
        AMOUNT_FIELD_IN_LIST: 'pay_rmn_amt',           // 列表页金额列
        AVAILABLE_AMOUNT_FIELD_IN_MATCH: 'pay_available_amt' // 匹配页余额列
    };

    // =================================================================
    // ⚙️ 辅助工具
    // =================================================================
    const Utils = {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

        clickElement: (element) => {
            if (!element) return false;
            try {
                element.click();
                return true;
            } catch (e) {
                try {
                    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    return true;
                } catch (e2) { return false; }
            }
        },

        findButton: (doc, text) => {
            if (!doc) return null;
            const buttons = doc.querySelectorAll('a, button, .l-btn-text, span.l-btn-text');
            for (const btn of buttons) {
                if (btn.textContent.trim() === text || btn.textContent.includes(text)) {
                    if (btn.tagName === 'SPAN' && btn.classList.contains('l-btn-text')) {
                        return btn.closest('.l-btn') || btn;
                    }
                    return btn;
                }
            }
            return null;
        },

        getPageDocs: () => {
            const getDoc = (iframe) => { try { return iframe.contentDocument || iframe.contentWindow.document; } catch(e){return null;} };
            const iframes = document.querySelectorAll('iframe');
            let middleDoc = null, innerDoc = null;

            for (const f of iframes) {
                const d = getDoc(f);
                if (d && d.querySelector('.smallBase-tap')) { middleDoc = { iframe: f, doc: d }; break; }
            }
            if (middleDoc) {
                const innerFrames = middleDoc.doc.querySelectorAll('iframe');
                for (const f of innerFrames) {
                    const d = getDoc(f);
                    if (d && d.body) { innerDoc = { iframe: f, doc: d }; break; }
                }
            }
            return { middle: middleDoc, inner: innerDoc };
        },

        waitForPage: async (btnText, maxWait = 25000) => {
            console.log(`⏳ 正在寻找“${btnText}”按钮...`);
            const start = Date.now();
            while (Date.now() - start < maxWait) {
                try {
                    const { middle, inner } = Utils.getPageDocs();
                    const d1 = inner?.doc, d2 = middle?.doc;
                    if ((d1 && Utils.findButton(d1, btnText)) || (d2 && Utils.findButton(d2, btnText))) {
                        await Utils.delay(1000);
                        return true;
                    }
                } catch (e) {}
                await Utils.delay(1000);
            }
            return false;
        }
    };

    // =================================================================
    // 1️⃣ 步骤1：选择数据并生成
    // =================================================================
    async function stepSelectAndGenerate(startIndex) {
        const savedData = JSON.parse(sessionStorage.getItem('batchProcessing'));
        const isRetrySingle = savedData ? savedData.isRetrySingle : false;

        console.log(`\n📋 === 步骤1: 处理数据 (Index ${startIndex}) | 模式: ${isRetrySingle ? '⚠️单条重试' : '⚡批量优先'} ===`);

        if (!await Utils.waitForPage('生成')) {
            alert('❌ 未检测到“生成”按钮，请确认您已打开数据列表页面！');
            return false;
        }

        const { inner } = Utils.getPageDocs();
        const doc = inner.doc;

        try {
            const leftRows = doc.querySelectorAll('.datagrid-view1 .datagrid-btable tr[id*="grid_datagrid-row"]');
            const rightRows = doc.querySelectorAll('.datagrid-view2 .datagrid-btable tr[id*="grid_datagrid-row"]');

            if (startIndex >= leftRows.length) {
                alert('🎉 处理完成！');
                sessionStorage.removeItem('batchProcessing');
                return 'completed';
            }

            // 1. 清空所有勾选
            doc.querySelectorAll('.datagrid-view1 input[type="checkbox"]:checked').forEach(cb => Utils.clickElement(cb));
            await Utils.delay(300);

            // 2. 获取目标科目
            const targetSubjectCell = rightRows[startIndex].querySelector('[field="dep_bgt_eco_code_name"]');
            const targetSubject = targetSubjectCell ? targetSubjectCell.textContent.trim() : '';

            if (!targetSubject) {
                console.error('❌ 无法获取起始行科目');
                sessionStorage.setItem('batchProcessing', JSON.stringify({
                    ...savedData, currentIndex: startIndex + 1, lastStep: 'matchAndSave'
                }));
                return true;
            }

            // 3. 勾选逻辑
            let batchCount = 0;
            let totalAmount = 0;

            if (isRetrySingle) {
                const cb = leftRows[startIndex].querySelector('input[type="checkbox"]');
                Utils.clickElement(cb);
                const amtCell = rightRows[startIndex].querySelector(`[field="${Config.AMOUNT_FIELD_IN_LIST}"]`);
                totalAmount = parseFloat(amtCell?.textContent.trim().replace(/,/g, '') || 0);
                batchCount = 1;
            } else {
                for (let i = startIndex; i < leftRows.length; i++) {
                    const currentSubjectCell = rightRows[i].querySelector('[field="dep_bgt_eco_code_name"]');
                    const currentSubject = currentSubjectCell ? currentSubjectCell.textContent.trim() : '';

                    if (currentSubject === targetSubject) {
                        const cb = leftRows[i].querySelector('input[type="checkbox"]');
                        if (cb && !cb.checked) {
                            Utils.clickElement(cb);
                            const amtCell = rightRows[i].querySelector(`[field="${Config.AMOUNT_FIELD_IN_LIST}"]`);
                            if (amtCell) totalAmount += parseFloat(amtCell.textContent.trim().replace(/,/g, '') || 0);
                            batchCount++;
                        }
                    }
                }
            }

            console.log(`✅ 已勾选 ${batchCount} 条，总金额: ${totalAmount.toFixed(2)}`);
            await Utils.delay(500);

            // 4. 点击生成
            const generateBtn = Utils.findButton(doc, '生成');
            if (generateBtn) {
                Utils.clickElement(generateBtn);
                sessionStorage.setItem('batchProcessing', JSON.stringify({
                    currentIndex: startIndex,
                    batchCount: batchCount,
                    currentDepEco: targetSubject,
                    currentAmount: totalAmount,
                    totalCount: leftRows.length,
                    needContinue: true,
                    isRetrySingle: false,
                    lastStep: 'selectAndGenerate'
                }));
                return true;
            }

        } catch (e) {
            console.error('❌ 步骤1出错:', e);
            return false;
        }
    }

    // =================================================================
    // 2️⃣ 步骤2：匹配与保存
    // =================================================================
    async function stepMatchAndSave() {
        console.log('\n🔍 === 步骤2: 匹配科目并保存 ===');

        if (!await Utils.waitForPage('保存')) {
            console.error('❌ 匹配页加载超时');
            return false;
        }

        const savedData = JSON.parse(sessionStorage.getItem('batchProcessing'));
        const { currentDepEco, currentAmount: totalBatchAmount, batchCount, currentIndex } = savedData;
        const { middle, inner } = Utils.getPageDocs();
        const doc = inner.doc;

        try {
            const rows = doc.querySelectorAll('tr[id*="quota-grid_datagrid-row-r2-2"]');
            let matchedIndex = -1;
            let availableAmount = 0;
            const targetCode = currentDepEco.split(' ')[0];

            for (let i = 0; i < rows.length; i++) {
                const cell = rows[i].querySelector('[field="dep_bgt_eco_code_name"]');
                if (cell && cell.textContent.trim().startsWith(targetCode)) {
                    matchedIndex = i;
                    const amtCell = rows[i].querySelector(`[field="${Config.AVAILABLE_AMOUNT_FIELD_IN_MATCH}"]`);
                    if (amtCell) availableAmount = parseFloat(amtCell.textContent.trim().replace(/,/g, '') || 0);
                    break;
                }
            }

            console.log(`💰 需支付: ${totalBatchAmount.toFixed(2)} | 余额: ${availableAmount.toFixed(2)} | 批次数量: ${batchCount}`);

            if (matchedIndex !== -1 && totalBatchAmount > availableAmount) {
                console.warn(`⚠️ 余额不足! (缺 ${totalBatchAmount - availableAmount})`);
                const returnBtn = Utils.findButton(doc, '返回') || Utils.findButton(middle.doc, '返回');
                if (returnBtn) {
                    Utils.clickElement(returnBtn);
                    if (await Utils.waitForPage('生成')) {
                        if (batchCount > 1) {
                            console.log('↩️ [策略] 批量失败，降级为单条重试');
                            sessionStorage.setItem('batchProcessing', JSON.stringify({
                                currentIndex: currentIndex,
                                isRetrySingle: true,
                                totalCount: savedData.totalCount,
                                needContinue: true,
                                lastStep: 'matchAndSave'
                            }));
                        } else {
                            console.log('⏭️ [策略] 单条金额仍超限，跳过此条');
                            sessionStorage.setItem('batchProcessing', JSON.stringify({
                                currentIndex: currentIndex + 1,
                                isRetrySingle: false,
                                totalCount: savedData.totalCount,
                                needContinue: true,
                                lastStep: 'matchAndSave'
                            }));
                        }
                        await Utils.delay(1000);
                        return true;
                    }
                }
                return false;
            }

            if (matchedIndex !== -1) {
                const leftRows = doc.querySelectorAll('tr[id*="quota-grid_datagrid-row-r2-1"]');
                const cb = leftRows[matchedIndex]?.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) Utils.clickElement(cb);
            }

            await Utils.delay(500);
            const importRow = doc.querySelector('tr[id*="import-grid_datagrid-row-r3-2-0"]');
            if (importRow) {
                const govCell = importRow.querySelector(`[field*="gov"]`) || importRow.querySelector(`[field]`);
                if (govCell) {
                    govCell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
                    await Utils.delay(500);
                    const panels = document.querySelectorAll('.combo-panel:not([style*="display: none"])');
                    panels.forEach(panel => {
                        panel.querySelectorAll('.combobox-item').forEach(item => {
                            if (item.textContent.includes('不是政府采购')) Utils.clickElement(item);
                        });
                    });
                }
            }

            await Utils.delay(800);
            const saveBtn = Utils.findButton(doc, '保存') || Utils.findButton(middle.doc, '保存');
            if (saveBtn) {
                Utils.clickElement(saveBtn);
                if (await Utils.waitForPage('生成')) {
                    console.log(`✅ 保存成功，继续处理新的 Index ${currentIndex}`);
                    sessionStorage.setItem('batchProcessing', JSON.stringify({
                        currentIndex: currentIndex,
                        totalCount: savedData.totalCount,
                        isRetrySingle: false,
                        needContinue: true,
                        lastStep: 'matchAndSave'
                    }));
                    await Utils.delay(1000);
                    return true;
                }
            }

        } catch (e) {
            console.error('❌ 步骤2出错:', e);
            return false;
        }
    }

    // =================================================================
    // 🔁 状态机 & 按钮显示
    // =================================================================
    function getCurrentPageType() {
        const { middle, inner } = Utils.getPageDocs();
        if (!middle || !inner) return 'unknown';
        if (Utils.findButton(inner.doc, '保存') || Utils.findButton(middle.doc, '保存')) return 'generate';
        if (Utils.findButton(inner.doc, '生成')) return 'list';
        return 'unknown';
    }

    async function checkAndContinue() {
        // 尝试嵌入按钮
        embedToolbarBtn();

        // 自动流转逻辑
        const savedData = sessionStorage.getItem('batchProcessing');
        if (savedData) {
            const data = JSON.parse(savedData);
            if (data.needContinue) {
                data.needContinue = false;
                sessionStorage.setItem('batchProcessing', JSON.stringify(data));

                const pageType = getCurrentPageType();
                if ((data.lastStep === 'init' || data.lastStep === 'matchAndSave') && pageType === 'list') {
                    await stepSelectAndGenerate(data.currentIndex);
                } else if (data.lastStep === 'selectAndGenerate' && pageType === 'generate') {
                    await stepMatchAndSave();
                } else {
                    data.needContinue = true;
                    sessionStorage.setItem('batchProcessing', JSON.stringify(data));
                }
            }
        }
    }

    // =================================================================
    // 🚀 启动
    // =================================================================
    function main() {
        console.log('\n🔄 === 开始批量处理 ===');
        if (getCurrentPageType() !== 'list') {
            alert('请在数据列表页点击！\n(如果已在列表页，请先手动点击一下表格区域，确保加载完成)');
            return;
        }

        const savedData = sessionStorage.getItem('batchProcessing');
        let startIndex = savedData ? JSON.parse(savedData).currentIndex : 0;

        sessionStorage.setItem('batchProcessing', JSON.stringify({
            currentIndex: startIndex,
            totalCount: 0,
            needContinue: true,
            isRetrySingle: false,
            lastStep: 'init'
        }));
    }

    // 🔴 嵌入式按钮 (Native Toolbar Style)
    function embedToolbarBtn() {
        const { inner } = Utils.getPageDocs();
        if (!inner) return;
        const doc = inner.doc;

        // 防止重复添加
        if (doc.getElementById('auto-entry-btn')) return;

        // 1. 寻找参考元素：.btn-more-content (更多按钮的下拉菜单容器，它紧跟在“更多”按钮后面)
        const moreContentDiv = doc.querySelector('.btn-more-content');
        if (!moreContentDiv) return; // 还没加载出来，下次循环再试

        console.log("🛠️ 正在嵌入工具栏按钮...");

        // 2. 创建原生风格的按钮
        // 复制页面原有按钮的 class: easyui-linkbutton action-btn btn_level_2 l-btn l-btn-small l-btn-plain
        const btn = doc.createElement('a');
        btn.id = 'auto-entry-btn';
        btn.href = 'javascript:void(0)';
        btn.className = 'easyui-linkbutton action-btn btn_level_2 l-btn l-btn-small l-btn-plain';
        // 稍微加点左边距，与“更多”隔开
        btn.style.marginLeft = '5px';
        btn.style.color = '#28a745'; // 用绿色突出显示

        // 3. 设置按钮内容
        btn.innerHTML = `
            <span class="l-btn-left">
                <span class="l-btn-text" style="font-weight:bold;">⚡ 自动录入</span>
            </span>
        `;

        // 4. 绑定点击事件
        btn.onclick = (e) => {
            e.preventDefault();
            const txt = btn.querySelector('.l-btn-text');
            const oldHtml = txt.innerHTML;
            txt.innerHTML = '⏳ 运行中...';
            // 运行时改变背景提示
            btn.classList.add('l-btn-selected');

            main();

            setTimeout(() => {
                txt.innerHTML = oldHtml;
                btn.classList.remove('l-btn-selected');
            }, 3000);
        };

        // 5. 插入 DOM：在 moreContentDiv 的后面
        // 原理：parent.insertBefore(new, ref.nextSibling) 等同于 insertAfter
        moreContentDiv.parentNode.insertBefore(btn, moreContentDiv.nextSibling);
    }

    // 延迟启动，确保页面元素就位
    setTimeout(() => {
        embedToolbarBtn();
        setInterval(checkAndContinue, 1000);
    }, 1500);

})();