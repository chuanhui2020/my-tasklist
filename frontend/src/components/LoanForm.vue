<template>
  <el-dialog v-model="visible" :title="editing ? '编辑贷款' : '新建贷款'" width="520px" class="glass-dialog" destroy-on-close>
    <el-form :model="form" label-position="top">
      <el-form-item label="贷款名称">
        <el-input v-model="form.name" placeholder="如：首套房贷" />
      </el-form-item>
      <el-form-item label="贷款银行">
        <el-input v-model="form.bank" placeholder="如：招商银行" />
      </el-form-item>
      <el-form-item label="贷款类型">
        <el-radio-group v-model="form.loan_type">
          <el-radio value="mortgage">🏠 房贷</el-radio>
          <el-radio value="bank_loan">🏦 银行贷款</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="剩余金额（元）">
        <el-input-number v-model="form.remaining_balance" :min="1" :step="10000" :controls="false" style="width: 100%" />
      </el-form-item>
      <el-form-item label="每月应还（元）">
        <el-input-number v-model="form.monthly_payment" :min="1" :step="100" :controls="false" style="width: 100%" />
      </el-form-item>
      <el-form-item label="剩余期数（月）">
        <el-input-number v-model="form.remaining_months" :min="1" :step="1" :controls="false" style="width: 100%" />
      </el-form-item>
      <el-form-item label="年利率（%，可选）">
        <el-input-number v-model="form.annual_rate" :min="0" :step="0.01" :precision="2" :controls="false" style="width: 100%" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.notes" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const props = defineProps({
  modelValue: Boolean,
  loan: Object,
})
const emit = defineEmits(['update:modelValue', 'saved'])

const visible = ref(false)
const loading = ref(false)
const editing = ref(false)

const form = ref(getEmpty())

function getEmpty() {
  return { name: '', bank: '', loan_type: 'mortgage', remaining_balance: 500000, monthly_payment: 3000, remaining_months: 360, annual_rate: 3.45, notes: '' }
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    if (props.loan) {
      editing.value = true
      form.value = { ...props.loan }
    } else {
      editing.value = false
      form.value = getEmpty()
    }
  }
})

watch(visible, (val) => {
  if (!val) emit('update:modelValue', false)
})

async function handleSave() {
  const f = form.value
  if (!f.name?.trim() || !f.bank?.trim()) {
    return ElMessage.warning('请填写名称和银行')
  }
  if (!f.remaining_balance || !f.monthly_payment || !f.remaining_months) {
    return ElMessage.warning('请填写金额信息')
  }
  loading.value = true
  try {
    if (editing.value) {
      await api.updateLoan(props.loan.id, f)
      ElMessage.success('更新成功')
    } else {
      await api.createLoan(f)
      ElMessage.success('创建成功')
    }
    visible.value = false
    emit('saved')
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}
</script>
